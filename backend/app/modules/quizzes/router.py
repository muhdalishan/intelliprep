"""MCQ generation, quiz sessions, scoring and weak-topic logging.

Two ways to quiz:
- /generate returns questions with their answers, for subjects that still live in the browser.
- Saved quizzes (/quizzes) are for account subjects. The questions are generated and stored by
  the server and come back WITHOUT answers; the database hides the correct option from the
  student's role entirely. An attempt is scored on the server, which then reveals the answers,
  stores the result and adds every wrong answer's topic to the student's weak topics.

Backlog: IP-42 (docs/scrum/product-backlog.md)
"""

import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import llm
from app.core.schemas import MultipleChoice, NotesRequest, is_well_formed
from app.core.security import CurrentUser, get_current_user
from app.core.usage import AIQuota
from app.db.errors import db_errors
from app.db.session import Sessions, UserDb, service_session, user_session

router = APIRouter(prefix="/quiz", tags=["quizzes"])

INSTRUCTIONS = """You write multiple-choice exam questions from a university student's notes.
Each question has exactly 4 options with one correct answer. Wrong options must be plausible
mistakes a student could make, not jokes. Mix recall, understanding and application.
The explanation says why the correct option is right, citing the idea from the notes.
Topic is a short name (2-5 words) for the idea being tested. Only use facts in the notes."""


Question = MultipleChoice


class _QuestionSet(BaseModel):
    questions: list[Question]


class QuizRequest(NotesRequest):
    count: int = Field(default=5, ge=3, le=15)


class QuizResponse(BaseModel):
    questions: list[Question]


async def _generate(body: QuizRequest) -> list[Question]:
    rule, material = llm.study_material(body.text, body.focus)
    prompt = f"Write exactly {body.count} questions.\n\n{material}"
    result = await llm.generate_structured(INSTRUCTIONS + rule, prompt, _QuestionSet)
    questions = [q for q in result.questions if is_well_formed(q)][: body.count]
    if not questions:
        raise llm.AIUnavailable("No questions could be made from this text. Try longer notes.")
    return questions


@router.post("/generate", dependencies=[AIQuota])
async def generate_quiz(
    body: QuizRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> QuizResponse:
    return QuizResponse(questions=await _generate(body))


# Saved quizzes, scored on the server ----------------------------------------------------------


class SavedQuizRequest(QuizRequest):
    subject_id: UUID
    title: str = Field(default="Practice quiz", min_length=1, max_length=120)
    source_document_ids: list[UUID] = Field(default_factory=list, max_length=20)


class QuestionOut(BaseModel):
    """A question as the student sees it before answering: no correct option, no explanation."""

    id: UUID
    position: int
    question: str
    options: list[str]
    topic: str


class Quiz(BaseModel):
    id: UUID
    subject_id: UUID
    title: str
    created_at: datetime
    questions: list[QuestionOut]


class QuizSummary(BaseModel):
    id: UUID
    subject_id: UUID
    title: str
    question_count: int
    created_at: datetime
    attempts: int
    best_score: int | None
    last_score: int | None


class Answer(BaseModel):
    question_id: UUID
    chosen_index: int | None = Field(default=None, ge=0, le=3, description="null = skipped")


class AttemptIn(BaseModel):
    answers: list[Answer] = Field(max_length=30)
    time_taken_s: int | None = Field(default=None, ge=0, le=6 * 60 * 60)


class QuestionResult(BaseModel):
    question_id: UUID
    chosen_index: int | None
    correct_index: int
    is_correct: bool
    explanation: str
    topic: str


class AttemptResult(BaseModel):
    attempt_id: UUID
    score: int
    total: int
    results: list[QuestionResult]
    new_weak_topics: list[str]


WeakOrigin = Literal["quiz", "flashcard", "exam", "manual"]


class WeakTopicIn(BaseModel):
    subject_id: UUID
    topic: str = Field(min_length=1, max_length=200)
    origin: WeakOrigin = "manual"
    note: str | None = Field(default=None, max_length=500)


class WeakTopic(BaseModel):
    id: UUID
    subject_id: UUID
    topic: str
    origin: WeakOrigin
    note: str | None
    misses: int
    last_missed_at: datetime


_UPSERT_WEAK = text(
    "insert into weak_topics (user_id, subject_id, topic, origin, note) "
    "values (:uid, :sid, :topic, :origin, :note) "
    "on conflict (user_id, subject_id, topic) do update set "
    "misses = weak_topics.misses + 1, last_missed_at = now(), "
    "note = coalesce(excluded.note, weak_topics.note) "
    "returning id, subject_id, topic, origin, note, misses, last_missed_at, (xmax = 0) as is_new"
)


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found.")


async def _questions(db: AsyncSession, quiz_id: UUID) -> list[QuestionOut]:
    rows = await db.execute(
        text(
            "select id, position, question, options, topic from quiz_questions "
            "where quiz_id = :id order by position"
        ),
        {"id": quiz_id},
    )
    return [QuestionOut(**row) for row in rows.mappings()]


@router.post("/quizzes", status_code=status.HTTP_201_CREATED, dependencies=[AIQuota])
async def create_quiz(
    body: SavedQuizRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    sessions: Sessions,
) -> Quiz:
    """Generates and stores a quiz; the answers stay on the server."""
    questions = await _generate(body)
    async with user_session(sessions, user) as db:
        with db_errors():
            quiz = (
                (
                    await db.execute(
                        text(
                            "insert into quizzes (subject_id, title, question_count, "
                            "source_document_ids) values (:sid, :title, :n, :docs) "
                            "returning id, subject_id, title, created_at"
                        ),
                        {
                            "sid": body.subject_id,
                            "title": body.title.strip(),
                            "n": len(questions),
                            "docs": body.source_document_ids,
                        },
                    )
                )
                .mappings()
                .one()
            )
    async with service_session(sessions) as db:
        await db.execute(
            text(
                "insert into quiz_questions (quiz_id, user_id, position, question, options, "
                "correct_index, explanation, topic) values (:quiz, :uid, :pos, :question, "
                "cast(:options as jsonb), :correct, :explanation, :topic)"
            ),
            [
                {
                    "quiz": quiz["id"],
                    "uid": user.id,
                    "pos": position,
                    "question": q.question,
                    "options": json.dumps(q.options),
                    "correct": q.correct_index,
                    "explanation": q.explanation,
                    "topic": q.topic,
                }
                for position, q in enumerate(questions, start=1)
            ],
        )
    async with user_session(sessions, user) as db:
        return Quiz(**quiz, questions=await _questions(db, quiz["id"]))


@router.get("/quizzes")
async def list_quizzes(db: UserDb, subject_id: UUID | None = None) -> list[QuizSummary]:
    rows = await db.execute(
        text(
            """
            select q.id, q.subject_id, q.title, q.question_count, q.created_at,
                   count(a.id) as attempts, max(a.score) as best_score,
                   (select a2.score from quiz_attempts a2 where a2.quiz_id = q.id
                    order by a2.submitted_at desc limit 1) as last_score
            from quizzes q left join quiz_attempts a on a.quiz_id = q.id
            where cast(:sid as uuid) is null or q.subject_id = :sid
            group by q.id order by q.created_at desc
            """
        ),
        {"sid": subject_id},
    )
    return [QuizSummary(**row) for row in rows.mappings()]


@router.get("/quizzes/{quiz_id}")
async def get_quiz(quiz_id: UUID, db: UserDb) -> Quiz:
    """The quiz to take (or retake), without answers."""
    quiz = (
        (
            await db.execute(
                text("select id, subject_id, title, created_at from quizzes where id = :id"),
                {"id": quiz_id},
            )
        )
        .mappings()
        .first()
    )
    if quiz is None:
        raise _not_found("Quiz")
    return Quiz(**quiz, questions=await _questions(db, quiz_id))


@router.delete("/quizzes/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quiz(quiz_id: UUID, db: UserDb) -> None:
    deleted = (
        await db.execute(text("delete from quizzes where id = :id returning 1"), {"id": quiz_id})
    ).first()
    if deleted is None:
        raise _not_found("Quiz")


@router.post("/quizzes/{quiz_id}/attempts", status_code=status.HTTP_201_CREATED)
async def submit_attempt(
    quiz_id: UUID,
    body: AttemptIn,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    sessions: Sessions,
) -> AttemptResult:
    """Scores the attempt on the server, records it, and logs wrong answers as weak topics."""
    async with user_session(sessions, user) as db:
        subject_id = (
            await db.execute(text("select subject_id from quizzes where id = :id"), {"id": quiz_id})
        ).scalar()
    if subject_id is None:
        raise _not_found("Quiz")

    chosen = {a.question_id: a.chosen_index for a in body.answers}
    async with service_session(sessions) as db:
        key = (
            (
                await db.execute(
                    text(
                        "select id, correct_index, explanation, topic from quiz_questions "
                        "where quiz_id = :id order by position"
                    ),
                    {"id": quiz_id},
                )
            )
            .mappings()
            .all()
        )
        unknown = set(chosen) - {q["id"] for q in key}
        if unknown:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Some answers are for questions that aren't in this quiz.",
            )
        results = [
            QuestionResult(
                question_id=q["id"],
                chosen_index=chosen.get(q["id"]),
                correct_index=q["correct_index"],
                is_correct=chosen.get(q["id"]) == q["correct_index"],
                explanation=q["explanation"],
                topic=q["topic"],
            )
            for q in key
        ]
        score = sum(r.is_correct for r in results)
        attempt_id = (
            await db.execute(
                text(
                    "insert into quiz_attempts (quiz_id, user_id, score, total, time_taken_s) "
                    "values (:quiz, :uid, :score, :total, :time) returning id"
                ),
                {
                    "quiz": quiz_id,
                    "uid": user.id,
                    "score": score,
                    "total": len(results),
                    "time": body.time_taken_s,
                },
            )
        ).scalar_one()
        await db.execute(
            text(
                "insert into attempt_answers (attempt_id, question_id, user_id, chosen_index, "
                "is_correct) values (:attempt, :question, :uid, :chosen, :correct)"
            ),
            [
                {
                    "attempt": attempt_id,
                    "question": r.question_id,
                    "uid": user.id,
                    "chosen": r.chosen_index,
                    "correct": r.is_correct,
                }
                for r in results
            ],
        )
        new_topics: list[str] = []
        for topic in dict.fromkeys(r.topic for r in results if not r.is_correct):
            params = {"uid": user.id, "sid": subject_id, "topic": topic, "origin": "quiz"}
            row = (await db.execute(_UPSERT_WEAK, {**params, "note": None})).mappings().one()
            if row["is_new"]:
                new_topics.append(topic)
    return AttemptResult(
        attempt_id=attempt_id,
        score=score,
        total=len(results),
        results=results,
        new_weak_topics=new_topics,
    )


# Weak topics ------------------------------------------------------------------------------------


@router.get("/weak-topics")
async def list_weak_topics(db: UserDb, subject_id: UUID | None = None) -> list[WeakTopic]:
    """Weak topics, most missed first."""
    rows = await db.execute(
        text(
            "select id, subject_id, topic, origin, note, misses, last_missed_at from weak_topics "
            "where cast(:sid as uuid) is null or subject_id = :sid "
            "order by misses desc, last_missed_at desc"
        ),
        {"sid": subject_id},
    )
    return [WeakTopic(**row) for row in rows.mappings()]


@router.post("/weak-topics", status_code=status.HTTP_201_CREATED)
async def add_weak_topic(
    body: WeakTopicIn, db: UserDb, user: Annotated[CurrentUser, Depends(get_current_user)]
) -> WeakTopic:
    """Flags a topic (e.g. from a flashcard); flagging it again counts another miss."""
    with db_errors():
        row = (
            (
                await db.execute(
                    _UPSERT_WEAK,
                    {
                        "uid": user.id,
                        "sid": body.subject_id,
                        "topic": body.topic.strip(),
                        "origin": body.origin,
                        "note": body.note,
                    },
                )
            )
            .mappings()
            .one()
        )
    return WeakTopic(**row)


@router.delete("/weak-topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_weak_topic(topic_id: UUID, db: UserDb) -> None:
    """The student has revised this topic."""
    deleted = (
        await db.execute(
            text("delete from weak_topics where id = :id returning 1"), {"id": topic_id}
        )
    ).first()
    if deleted is None:
        raise _not_found("Weak topic")
