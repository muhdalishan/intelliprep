"""Aggregated dashboard: due cards, predictions, task counts, quiz scores, streak.

One request returns everything the "what should I study today?" screen needs. It only reads,
in the student's own session, so row-level security decides every number: their own subjects
and data, plus subjects shared with their groups. Flashcards, quiz scores and weak topics stay
personal even in shared subjects.
"""

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import text

from app.core.streaks import local_today, study_streak
from app.db.session import UserDb

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class NextExam(BaseModel):
    subject_id: UUID
    subject_name: str
    exam_date: date
    days_left: int


class TaskCounts(BaseModel):
    todo: int = 0
    learning: int = 0
    practiced: int = 0
    mastered: int = 0


class Prediction(BaseModel):
    subject_name: str
    topic_name: str
    confidence: float


class RecentDocument(BaseModel):
    id: UUID
    subject_id: UUID
    filename: str
    status: str
    created_at: datetime


class QuizScore(BaseModel):
    quiz_title: str
    subject_name: str
    score: int
    total: int
    submitted_at: datetime


class UpcomingReminder(BaseModel):
    id: UUID
    message: str
    due_at: datetime
    channel: str
    subject_name: str | None


class Dashboard(BaseModel):
    subjects: int
    next_exam: NextExam | None
    cards_due_today: int
    streak_days: int
    reviewed_today: bool
    tasks: TaskCounts
    top_predictions: list[Prediction]
    recent_documents: list[RecentDocument]
    upcoming_reminders: list[UpcomingReminder]
    weak_topics: int
    recent_quiz_scores: list[QuizScore]


@router.get("")
async def dashboard(db: UserDb) -> Dashboard:
    zone = (await db.execute(text("select timezone from profiles"))).scalar()
    today = local_today(zone)  # the student's own date, like the flashcard queue

    subjects = (await db.execute(text("select count(*) from subjects"))).scalar_one()

    exam = (
        (
            await db.execute(
                text(
                    "select id as subject_id, name as subject_name, exam_date from subjects "
                    "where exam_date >= :today order by exam_date, name limit 1"
                ),
                {"today": today},
            )
        )
        .mappings()
        .first()
    )

    # Only the student's own cards: flashcards are personal even in shared subjects.
    due = (
        await db.execute(
            text(
                "select count(*) from flashcards where user_id = (select auth.uid()) "
                "and (next_review is null or next_review <= :today)"
            ),
            {"today": today},
        )
    ).scalar_one()

    days = {
        row[0]
        for row in await db.execute(
            text(
                "select distinct reviewed_on from flashcard_reviews "
                "where user_id = (select auth.uid()) and reviewed_on > :since"
            ),
            {"since": date.fromordinal(today.toordinal() - 400)},
        )
    }

    tasks = TaskCounts(
        **{
            row.status: row.n
            for row in await db.execute(
                text("select status, count(*) as n from subject_tasks group by status")
            )
        }
    )

    predictions = [
        Prediction(**row)
        for row in (
            await db.execute(
                text(
                    "select s.name as subject_name, p.topic_name, p.confidence "
                    "from exam_predictions p join subjects s on s.id = p.subject_id "
                    "order by p.confidence desc, p.rank limit 5"
                )
            )
        ).mappings()
    ]

    documents = [
        RecentDocument(**row)
        for row in (
            await db.execute(
                text(
                    "select id, subject_id, filename, status, created_at from documents "
                    "order by created_at desc limit 5"
                )
            )
        ).mappings()
    ]

    reminders = [
        UpcomingReminder(**row)
        for row in (
            await db.execute(
                text(
                    "select id, message, due_at, channel, subject_name from reminders "
                    "where status = 'pending' and due_at >= now() order by due_at limit 5"
                )
            )
        ).mappings()
    ]

    weak = (
        await db.execute(
            text("select count(*) from weak_topics where user_id = (select auth.uid())")
        )
    ).scalar_one()

    scores = [
        QuizScore(**row)
        for row in (
            await db.execute(
                text(
                    "select q.title as quiz_title, s.name as subject_name, a.score, a.total, "
                    "a.submitted_at from quiz_attempts a join quizzes q on q.id = a.quiz_id "
                    "join subjects s on s.id = q.subject_id "
                    "where a.user_id = (select auth.uid()) order by a.submitted_at desc limit 5"
                )
            )
        ).mappings()
    ]

    return Dashboard(
        subjects=subjects,
        next_exam=NextExam(**exam, days_left=(exam["exam_date"] - today).days) if exam else None,
        cards_due_today=due,
        streak_days=study_streak(days, today),
        reviewed_today=today in days,
        tasks=tasks,
        top_predictions=predictions,
        recent_documents=documents,
        upcoming_reminders=reminders,
        weak_topics=weak,
        recent_quiz_scores=scores,
    )
