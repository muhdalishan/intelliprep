"""Retrieval: embeddings, hybrid search, reranking, grounded answers with citations.

Ask a question about a subject; the answer comes only from the passages found in that subject's
indexed documents, with the document and pages each point came from. When nothing relevant is
found, the student is told it isn't in their notes and no AI call is made.

Backlog: IP-30, IP-31, IP-32, IP-33, IP-34, IP-35 (docs/scrum/product-backlog.md)
"""

import re
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core import llm
from app.db.session import UserDb
from app.modules.rag.search import Passage, hybrid_search

router = APIRouter(prefix="/rag", tags=["rag"])

NOT_IN_NOTES = "I couldn't find this in your notes for this subject."

INSTRUCTIONS = """You answer a university student's question using only the numbered sources from
their own notes. Explain clearly, like a good teacher, in a few short paragraphs or a list.
After each fact, cite the source it came from in square brackets, e.g. [2].
If the sources don't contain the answer, set in_notes to false and say so in one sentence;
never fill gaps from general knowledge. sources_used lists every source number you cited."""


class AskRequest(BaseModel):
    subject_id: UUID
    question: str = Field(min_length=3, max_length=1_000)
    k: int = Field(default=8, ge=1, le=20, description="How many passages to answer from")


class Citation(BaseModel):
    number: int
    document_id: UUID
    filename: str
    page_start: int
    page_end: int
    excerpt: str


class AskResponse(BaseModel):
    answer: str
    in_notes: bool
    citations: list[Citation]


class _Answer(BaseModel):
    answer: str
    in_notes: bool
    sources_used: list[int]


def _sources(passages: list[Passage]) -> str:
    blocks = []
    for number, p in enumerate(passages, start=1):
        pages = (
            f"p. {p.page_start}"
            if p.page_start == p.page_end
            else f"pp. {p.page_start}-{p.page_end}"
        )
        blocks.append(f"[{number}] {p.filename}, {pages}\n{p.content}")
    return llm.as_notes("\n\n".join(blocks))


def _excerpt(content: str, limit: int = 280) -> str:
    flat = " ".join(content.split())
    return flat if len(flat) <= limit else flat[:limit].rsplit(" ", 1)[0] + "…"


@router.post("/query")
async def ask(body: AskRequest, db: UserDb) -> AskResponse:
    visible = (
        await db.execute(text("select 1 from subjects where id = :sid"), {"sid": body.subject_id})
    ).first()
    if visible is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found.")

    question = body.question.strip()
    [vector] = await llm.embed([question])
    passages = await hybrid_search(db, body.subject_id, question, vector, body.k)
    if not passages:
        return AskResponse(answer=NOT_IN_NOTES, in_notes=False, citations=[])

    result = await llm.generate_structured(
        INSTRUCTIONS, f"Question: {question}\n\n{_sources(passages)}", _Answer
    )
    # Trust the numbers the answer actually cites, and only ones that exist.
    cited = {int(n) for n in re.findall(r"\[(\d+)\]", result.answer)} | set(result.sources_used)
    citations = [
        Citation(
            number=number,
            document_id=p.document_id,
            filename=p.filename,
            page_start=p.page_start,
            page_end=p.page_end,
            excerpt=_excerpt(p.content),
        )
        for number, p in enumerate(passages, start=1)
        if number in cited
    ]
    in_notes = result.in_notes and bool(citations)
    return AskResponse(
        answer=result.answer if in_notes else NOT_IN_NOTES, in_notes=in_notes, citations=citations
    )
