"""Summary generation grounded in retrieved chunks, with saved history.

- /generate summarises text the student sends (subjects still in the browser). Nothing is saved.
- /documents summarises documents already saved to an account subject from their stored,
  page-numbered chunks, so every point can cite its page, and saves the result.
- /saved keeps a summary the student made (e.g. from /generate) and lists their history.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core import llm
from app.core.schemas import MAX_NOTES_CHARS, NotesRequest
from app.core.security import CurrentUser, get_current_user
from app.core.usage import AIQuota
from app.db.errors import db_errors
from app.db.session import UserDb

router = APIRouter(prefix="/summary", tags=["summaries"])

INSTRUCTIONS = """You write revision summaries for university students in Pakistan preparing for
exams.
Summarise only what is in the student's notes; do not add facts the notes don't contain.
Structure: a one-line overview, then each main topic as a heading with its sub-topics and the key
points, definitions and formulas as short bullets. Use plain text with '#' headings and '-' bullets.
Keep formulas exactly as written in the notes."""

CITE_PAGES = """The notes are split by "--- <file>, p. N ---" markers. End every bullet with the
page it came from, like (p. 4), or (week3.pdf, p. 4) when there are several files."""


class SummaryResponse(BaseModel):
    summary: str


@router.post("/generate", dependencies=[AIQuota])
async def generate_summary(
    body: NotesRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> SummaryResponse:
    rule, material = llm.study_material(body.text, body.focus)
    summary = await llm.generate_text(INSTRUCTIONS + rule, material)
    return SummaryResponse(summary=summary)


# Saved summaries ----------------------------------------------------------------------------


class SavedSummary(BaseModel):
    id: UUID
    subject_id: UUID
    title: str
    content: str
    source_document_ids: list[UUID]
    cites_pages: bool
    created_at: datetime


class SummaryIn(BaseModel):
    subject_id: UUID
    title: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=MAX_NOTES_CHARS)
    source_document_ids: list[UUID] = Field(default_factory=list, max_length=20)


class FromDocuments(BaseModel):
    subject_id: UUID
    document_ids: list[UUID] = Field(min_length=1, max_length=10)
    title: str | None = Field(default=None, max_length=160)
    focus: str | None = Field(default=None, max_length=500)


_COLUMNS = "id, subject_id, title, content, source_document_ids, cites_pages, created_at"


async def _save(db: UserDb, values: dict) -> SavedSummary:
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        "insert into summaries (subject_id, title, content, source_document_ids, "  # noqa: S608
                        "cites_pages) values (:subject_id, :title, :content, :source_document_ids, "
                        f":cites_pages) returning {_COLUMNS}"
                    ),
                    values,
                )
            )
            .mappings()
            .one()
        )
    return SavedSummary(**row)


@router.post("/documents", status_code=status.HTTP_201_CREATED, dependencies=[AIQuota])
async def summarise_documents(body: FromDocuments, db: UserDb) -> SavedSummary:
    """Summarises saved documents with page citations and keeps the summary."""
    rows = (
        await db.execute(
            text(
                "select d.id as document_id, d.filename, c.page_start, c.page_end, c.content "
                "from document_chunks c join documents d on d.id = c.document_id "
                "where d.subject_id = :sid and d.id = any(:ids) and d.status = 'completed' "
                "order by d.created_at, c.chunk_index"
            ),
            {"sid": body.subject_id, "ids": body.document_ids},
        )
    ).mappings().all()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No searchable documents found. Upload them first and wait until they're ready.",
        )

    parts, used, seen = [], 0, set()
    for row in rows:
        pages = (
            f"p. {row['page_start']}"
            if row["page_start"] == row["page_end"]
            else f"pp. {row['page_start']}-{row['page_end']}"
        )
        block = f"--- {row['filename']}, {pages} ---\n{row['content']}"
        if used + len(block) > MAX_NOTES_CHARS:
            break
        parts.append(block)
        used += len(block)
        seen.add(row["document_id"])

    focus = f"Focus on: {body.focus}\n\n" if body.focus else ""
    content = await llm.generate_text(
        f"{INSTRUCTIONS}\n{CITE_PAGES}", focus + llm.as_notes("\n\n".join(parts))
    )
    filenames = list(dict.fromkeys(r["filename"] for r in rows if r["document_id"] in seen))
    return await _save(
        db,
        {
            "subject_id": body.subject_id,
            "title": (body.title or f"Summary of {', '.join(filenames)}")[:160],
            "content": content,
            "source_document_ids": [r for r in body.document_ids if r in seen],
            "cites_pages": True,
        },
    )


@router.post("/saved", status_code=status.HTTP_201_CREATED)
async def save_summary(body: SummaryIn, db: UserDb) -> SavedSummary:
    return await _save(db, {**body.model_dump(), "title": body.title.strip(), "cites_pages": False})


@router.get("/saved")
async def list_summaries(db: UserDb, subject_id: UUID | None = None) -> list[SavedSummary]:
    rows = await db.execute(
        text(
            f"select {_COLUMNS} from summaries "  # noqa: S608
            "where cast(:sid as uuid) is null or subject_id = :sid order by created_at desc"
        ),
        {"sid": subject_id},
    )
    return [SavedSummary(**row) for row in rows.mappings()]


@router.delete("/saved/{summary_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_summary(summary_id: UUID, db: UserDb) -> None:
    deleted = (
        await db.execute(
            text("delete from summaries where id = :id returning 1"), {"id": summary_id}
        )
    ).first()
    if deleted is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary not found.")
