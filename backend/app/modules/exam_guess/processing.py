"""Turn an uploaded past paper into ranked exam-topic predictions (IP-60, IP-61).

The job extracts each question with the AI, embeds the questions, stores them, then re-ranks the
subject's topics from all its past papers (ranking.py) and asks the AI for a short name for each
topic. Like document indexing, it runs as a background task until the Redis worker (IP-21).
"""

import json
import logging
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core import llm
from app.core.usage import DatabaseUsageStore, metered
from app.db.session import service_session
from app.modules.exam_guess.ranking import MIN_PAPERS, PastQuestion, predict_topics

log = logging.getLogger(__name__)

MAX_TOPICS = 10

EXTRACT = """You read a university exam paper and list every question in it.
Keep each question's own number (like 1, 2(a), Q3-ii) and its marks if shown. Split a question
into its parts when the parts test different things. Copy the wording faithfully; leave out
instructions to candidates, headers and page numbers."""

LABEL = """You name topics for a university student. Each numbered group holds exam questions
about one idea. Give each group a short topic name (2-6 words) a student would recognise from
their syllabus, in the same order as the groups."""


class _Question(BaseModel):
    number: str | None = Field(default=None, max_length=20)
    text: str
    marks: int | None = None


class _Paper(BaseModel):
    questions: list[_Question]


class _Labels(BaseModel):
    names: list[str]


async def _process_past_paper(
    factory: async_sessionmaker[AsyncSession],
    paper_id: UUID,
    user_id: str,
    subject_id: UUID,
    paper_text: str,
) -> None:
    try:
        extracted = await llm.generate_structured(EXTRACT, llm.as_notes(paper_text), _Paper)
        questions = [q for q in extracted.questions if q.text.strip()]
        if not questions:
            raise llm.AIUnavailable("No questions could be found in this paper.")
        vectors = await llm.embed([q.text for q in questions])
        async with service_session(factory) as db:
            await db.execute(
                text(
                    "insert into past_paper_questions (paper_id, user_id, question_number, "
                    "question_text, marks, embedding) values (:paper, :uid, :number, :text, "
                    ":marks, cast(:embedding as extensions.vector))"
                ),
                [
                    {
                        "paper": paper_id,
                        "uid": user_id,
                        "number": q.number,
                        "text": q.text.strip(),
                        "marks": q.marks,
                        "embedding": llm.as_vector(v),
                    }
                    for q, v in zip(questions, vectors, strict=True)
                ],
            )
            await db.execute(
                text(
                    "update past_papers set status = 'completed', question_count = :n, "
                    "failure_reason = null where id = :id"
                ),
                {"n": len(questions), "id": paper_id},
            )
    except Exception as exc:
        log.exception("Processing past paper %s failed", paper_id)
        reason = (
            str(exc)
            if isinstance(exc, llm.AIUnavailable)
            else "Something went wrong reading this paper. Try uploading it again."
        )
        async with service_session(factory) as db:
            await db.execute(
                text(
                    "update past_papers set status = 'failed', failure_reason = :r "
                    "where id = :id"
                ),
                {"r": reason, "id": paper_id},
            )
        return
    await refresh_predictions(factory, subject_id, user_id)


async def refresh_predictions(
    factory: async_sessionmaker[AsyncSession], subject_id: UUID, user_id: str
) -> int:
    """Re-ranks the subject's topics from all its processed papers. Returns how many topics."""
    async with service_session(factory) as db:
        rows = (
            await db.execute(
                text(
                    "select q.id, q.paper_id, p.year, q.question_text, "
                    "q.embedding::text as embedding "
                    "from past_paper_questions q join past_papers p on p.id = q.paper_id "
                    "where p.subject_id = :sid and p.user_id = :uid and p.status = 'completed' "
                    "and q.embedding is not null"
                ),
                {"sid": subject_id, "uid": user_id},
            )
        ).mappings().all()
        await db.execute(
            text("delete from exam_predictions where subject_id = :sid and user_id = :uid"),
            {"sid": subject_id, "uid": user_id},
        )
        papers = {row["paper_id"] for row in rows}
        if len(papers) < MIN_PAPERS:
            return 0

        topics = predict_topics(
            [
                PastQuestion(
                    id=str(r["id"]),
                    paper_id=str(r["paper_id"]),
                    year=r["year"],
                    text=r["question_text"],
                    embedding=json.loads(r["embedding"]),
                )
                for r in rows
            ]
        )[:MAX_TOPICS]

        groups = "\n\n".join(
            f"Group {n}:\n" + "\n".join(f"- {q.text[:300]}" for q in topic.questions[:3])
            for n, topic in enumerate(topics, start=1)
        )
        try:
            labels = (await llm.generate_structured(LABEL, llm.as_notes(groups), _Labels)).names
        except llm.AIUnavailable:
            labels = []
        await db.execute(
            text(
                "insert into exam_predictions (user_id, subject_id, rank, topic_name, confidence, "
                "frequency, years, question_ids) values (:uid, :sid, :rank, :name, :confidence, "
                ":frequency, :years, :ids)"
            ),
            [
                {
                    "uid": user_id,
                    "sid": subject_id,
                    "rank": rank,
                    "name": (labels[rank - 1] if rank <= len(labels) else "")
                    or topic.representative.text[:80],
                    "confidence": topic.confidence,
                    "frequency": topic.frequency,
                    "years": list(topic.years),
                    "ids": [UUID(q.id) for q in topic.questions],
                }
                for rank, topic in enumerate(topics, start=1)
            ],
        )
        return len(topics)


async def process_past_paper(
    factory: async_sessionmaker[AsyncSession],
    paper_id: UUID,
    user_id: str,
    subject_id: UUID,
    paper_text: str,
) -> None:
    """The job, with its AI tokens counted toward the student's daily AI budget."""
    async with metered(DatabaseUsageStore(factory), user_id):
        await _process_past_paper(factory, paper_id, user_id, subject_id, paper_text)
