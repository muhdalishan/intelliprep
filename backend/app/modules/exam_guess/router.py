"""Exam-Guess engine: past papers, question clustering, ranked topic predictions.

For account subjects, the real engine ranks topics from the student's own past papers: upload
them to /papers (questions are extracted and embedded in the background, processing.py), and
/predictions returns topics ranked by frequency x recency (ranking.py) once 3 or more are in.
/guess gives a notes-based estimate, which the UI labels as such, for everything else.

Backlog: IP-60, IP-61, IP-62 (docs/scrum/product-backlog.md)
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core import llm
from app.core.pdf import PdfError, extract_pdf
from app.core.schemas import MAX_NOTES_CHARS
from app.core.security import CurrentUser, get_current_user
from app.core.usage import AIQuota
from app.db.errors import db_errors
from app.db.session import Sessions, UserDb, user_session
from app.modules.exam_guess.processing import process_past_paper, refresh_predictions
from app.modules.exam_guess.ranking import MIN_PAPERS

router = APIRouter(prefix="/exam-guess", tags=["exam-guess"])

INSTRUCTIONS = """You help a university student in Pakistan prepare for a final exam.
From the course notes, estimate which topics are most likely to be examined and how heavily,
based on how central and how much covered each topic is in the notes. Be honest that this is an
estimate from notes, not from past papers. Sample questions should match university exam style
(long answer, short answer, problem solving) and come with an answer outline.
Probability must be High, Medium or Low. Weights are percentages that add up to about 100."""


class Prediction(BaseModel):
    topic: str
    probability: Literal["High", "Medium", "Low"]
    reason: str
    estimatedWeight: str  # noqa: N815 - matches the frontend's field name


class SampleQuestion(BaseModel):
    question: str
    format: str
    suggestedStructure: str  # noqa: N815


class GuessResponse(BaseModel):
    predictions: list[Prediction]
    sampleQuestions: list[SampleQuestion]  # noqa: N815
    strategicAdvice: str  # noqa: N815


class GuessRequest(BaseModel):
    subject_name: str = Field(min_length=1, max_length=120)
    text: str = Field(default="", max_length=60_000)
    focus: str | None = Field(default=None, max_length=500)


@router.post("/guess", dependencies=[AIQuota])
async def guess_from_notes(
    body: GuessRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> GuessResponse:
    notes = llm.as_notes(body.text) if body.text.strip() else "(no notes provided yet)"
    focus = f"Focus on: {body.focus}\n" if body.focus else ""
    prompt = (
        f"Subject: {body.subject_name}\n{focus}"
        "Give 4-6 predicted topics, 2-3 sample questions and short strategic advice.\n\n"
        f"{notes}"
    )
    return await llm.generate_structured(INSTRUCTIONS, prompt, GuessResponse)


# Past papers and ranked predictions (IP-60, IP-61) -------------------------------------------

MAX_PAPER_BYTES = 25 * 1024 * 1024
ExamKind = Literal["mid", "final", "quiz", "other"]


class PastPaper(BaseModel):
    id: UUID
    subject_id: UUID
    exam: ExamKind
    year: int
    filename: str
    status: Literal["processing", "completed", "failed"]
    failure_reason: str | None
    question_count: int
    created_at: datetime


class ExampleQuestion(BaseModel):
    text: str
    year: int
    marks: int | None


class RankedTopic(BaseModel):
    rank: int
    topic_name: str
    confidence: float
    """Recency-weighted share of papers the topic appeared in, 0 to 1."""
    frequency: float
    """Share of papers the topic appeared in, 0 to 1."""
    years: list[int]
    example_questions: list[ExampleQuestion]


class Predictions(BaseModel):
    papers: int
    ready: bool
    papers_needed: int
    topics: list[RankedTopic]


async def _paper_text(file: UploadFile) -> str:
    data = await file.read(MAX_PAPER_BYTES + 1)
    if len(data) > MAX_PAPER_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="This file is over 25 MB."
        )
    if data.startswith(b"%PDF-"):
        try:
            pages = (await run_in_threadpool(extract_pdf, data)).pages
        except PdfError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
            ) from exc
        content = "\n\n".join(p for p in pages if p)
    elif (file.filename or "").lower().endswith((".txt", ".md")):
        content = data.decode("utf-8", errors="replace")
    else:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload the paper as a PDF or a text file.",
        )
    if not content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="No text could be read from this paper. Scanned papers need OCR (coming soon).",
        )
    return content[:MAX_NOTES_CHARS]


@router.post("/papers", status_code=status.HTTP_202_ACCEPTED, dependencies=[AIQuota])
async def upload_past_paper(
    subject_id: Annotated[UUID, Form()],
    year: Annotated[int, Form(ge=1990, le=2100)],
    file: UploadFile,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    sessions: Sessions,
    background: BackgroundTasks,
    exam: Annotated[ExamKind, Form()] = "final",
) -> PastPaper:
    """Adds a past paper; its questions are extracted and topics re-ranked in the background."""
    content = await _paper_text(file)
    async with user_session(sessions, user) as db:
        with db_errors():
            row = (
                (
                    await db.execute(
                        text(
                            "insert into past_papers (subject_id, exam, year, filename) "
                            "values (:sid, :exam, :year, :filename) returning id, subject_id, "
                            "exam, year, filename, status, failure_reason, question_count, "
                            "created_at"
                        ),
                        {
                            "sid": subject_id,
                            "exam": exam,
                            "year": year,
                            "filename": (file.filename or "paper")[:200],
                        },
                    )
                )
                .mappings()
                .one()
            )
    background.add_task(process_past_paper, sessions, row["id"], user.id, subject_id, content)
    return PastPaper(**row)


@router.get("/papers")
async def list_past_papers(subject_id: UUID, db: UserDb) -> list[PastPaper]:
    rows = await db.execute(
        text(
            "select id, subject_id, exam, year, filename, status, failure_reason, question_count, "
            "created_at from past_papers where subject_id = :sid order by year desc, exam"
        ),
        {"sid": subject_id},
    )
    return [PastPaper(**row) for row in rows.mappings()]


@router.delete("/papers/{paper_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_past_paper(
    paper_id: UUID,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    sessions: Sessions,
    background: BackgroundTasks,
) -> None:
    async with user_session(sessions, user) as db:
        subject_id = (
            await db.execute(
                text("delete from past_papers where id = :id returning subject_id"),
                {"id": paper_id},
            )
        ).scalar()
    if subject_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Past paper not found.")
    background.add_task(refresh_predictions, sessions, subject_id, user.id)


@router.get("/predictions")
async def ranked_predictions(subject_id: UUID, db: UserDb) -> Predictions:
    """Topics ranked from the student's past papers, with example questions and the years seen."""
    papers = (
        await db.execute(
            text(
                "select count(*) from past_papers where subject_id = :sid and status = 'completed'"
            ),
            {"sid": subject_id},
        )
    ).scalar_one()
    rows = (
        await db.execute(
            text(
                "select rank, topic_name, confidence, frequency, years, question_ids "
                "from exam_predictions where subject_id = :sid order by rank"
            ),
            {"sid": subject_id},
        )
    ).mappings().all()
    examples: dict[UUID, ExampleQuestion] = {}
    ids = [qid for row in rows for qid in row["question_ids"]]
    if ids:
        for q in (
            await db.execute(
                text(
                    "select q.id, q.question_text as text, p.year, q.marks "
                    "from past_paper_questions q join past_papers p on p.id = q.paper_id "
                    "where q.id = any(:ids)"
                ),
                {"ids": ids},
            )
        ).mappings():
            examples[q["id"]] = ExampleQuestion(text=q["text"], year=q["year"], marks=q["marks"])
    topics = [
        RankedTopic(
            rank=row["rank"],
            topic_name=row["topic_name"],
            confidence=row["confidence"],
            frequency=row["frequency"],
            years=list(row["years"]),
            example_questions=sorted(
                (examples[q] for q in row["question_ids"] if q in examples),
                key=lambda e: -e.year,
            )[:3],
        )
        for row in rows
    ]
    return Predictions(
        papers=papers,
        ready=bool(topics),
        papers_needed=max(0, MIN_PAPERS - papers),
        topics=topics,
    )
