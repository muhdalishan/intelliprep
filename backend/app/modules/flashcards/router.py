"""Flashcard generation and SM-2 spaced-repetition review (due queue, rating, streak).

/generate makes cards from the text the student sends. Saved decks live in the database: every
card starts with SM-2's starting values, the due queue shows what to review today (in the
student's own time zone), and each rating updates that card's schedule and the study streak.
Cards are personal, even in a subject shared with a group.
"""

from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.core import llm
from app.core.schemas import NotesRequest
from app.core.security import CurrentUser, get_current_user
from app.core.streaks import local_today, study_streak
from app.core.usage import AIQuota
from app.db.errors import db_errors
from app.db.session import UserDb
from app.modules.flashcards.sm2 import INITIAL_EASE_FACTOR, Rating, Schedule, review

router = APIRouter(prefix="/flashcards", tags=["flashcards"])

INSTRUCTIONS = """You make flashcards for active recall from a university student's notes.
Each card tests one idea: a definition, a formula, a cause and effect, a comparison or a step.
Front: a short question or term. Back: the answer in one or two sentences, using the notes'
own wording and symbols. Only use facts that are in the notes. No duplicate cards."""


class Card(BaseModel):
    front: str
    back: str


class _Deck(BaseModel):
    cards: list[Card]


class FlashcardsRequest(NotesRequest):
    count: int = Field(default=8, ge=3, le=20)


class FlashcardsResponse(BaseModel):
    cards: list[Card]


@router.post("/generate", dependencies=[AIQuota])
async def generate_flashcards(
    body: FlashcardsRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> FlashcardsResponse:
    rule, material = llm.study_material(body.text, body.focus)
    prompt = f"Make exactly {body.count} flashcards.\n\n{material}"
    deck = await llm.generate_structured(INSTRUCTIONS + rule, prompt, _Deck)
    cards = [c for c in deck.cards if c.front.strip() and c.back.strip()][: body.count]
    if not cards:
        raise llm.AIUnavailable("No flashcards could be made from this text. Try longer notes.")
    return FlashcardsResponse(cards=cards)


# Saved decks and review ---------------------------------------------------------------------


class DeckIn(BaseModel):
    subject_id: UUID
    title: str = Field(min_length=1, max_length=120)
    cards: list[Card] = Field(min_length=1, max_length=100)
    source_document_ids: list[UUID] = Field(default_factory=list, max_length=20)


class Deck(BaseModel):
    id: UUID
    subject_id: UUID
    title: str
    card_count: int
    due_count: int
    mastered_count: int
    """Cards answered correctly at least 3 reviews in a row."""
    created_at: datetime


class DueCard(BaseModel):
    id: UUID
    deck_id: UUID | None
    subject_id: UUID
    front: str
    back: str
    repetitions: int
    interval_days: int


class DueQueue(BaseModel):
    today: date
    due_total: int
    cards: list[DueCard]
    streak_days: int
    reviewed_today: bool


class ReviewIn(BaseModel):
    rating: Rating


class Reviewed(BaseModel):
    id: UUID
    rating: Rating
    ease_factor: float
    interval_days: int
    repetitions: int
    next_review: date
    streak_days: int


async def _today(db: UserDb) -> date:
    zone = (await db.execute(text("select timezone from profiles"))).scalar()
    return local_today(zone)


async def _streak(db: UserDb, today: date) -> tuple[int, bool]:
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
    return study_streak(days, today), today in days


_DECKS = text(
    """
    select d.id, d.subject_id, d.title, d.created_at,
           count(f.id) as card_count,
           count(f.id) filter (where f.next_review is null or f.next_review <= :today) as due_count,
           count(f.id) filter (where f.repetitions >= 3) as mastered_count
    from flashcard_decks d left join flashcards f on f.deck_id = d.id
    where (cast(:sid as uuid) is null or d.subject_id = :sid)
    group by d.id order by d.created_at desc
    """
)


@router.post("/decks", status_code=status.HTTP_201_CREATED)
async def save_deck(body: DeckIn, db: UserDb) -> Deck:
    """Saves generated (or edited) cards as a deck; every card is due right away."""
    cards = [c for c in body.cards if c.front.strip() and c.back.strip()]
    if not cards:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="The deck has no cards."
        )
    with db_errors():
        deck_id = (
            await db.execute(
                text(
                    "insert into flashcard_decks (subject_id, title, source_document_ids) "
                    "values (:sid, :title, :docs) returning id"
                ),
                {
                    "sid": body.subject_id,
                    "title": body.title.strip(),
                    "docs": body.source_document_ids,
                },
            )
        ).scalar_one()
        await db.execute(
            text(
                "insert into flashcards (subject_id, deck_id, term, definition, ease_factor) "
                "values (:sid, :deck, :front, :back, :ease)"
            ),
            [
                {
                    "sid": body.subject_id,
                    "deck": deck_id,
                    "front": c.front.strip(),
                    "back": c.back.strip(),
                    "ease": INITIAL_EASE_FACTOR,
                }
                for c in cards
            ],
        )
    today = await _today(db)
    rows = (await db.execute(_DECKS, {"today": today, "sid": body.subject_id})).mappings()
    return next(Deck(**row) for row in rows if row["id"] == deck_id)


@router.get("/decks")
async def list_decks(db: UserDb, subject_id: UUID | None = None) -> list[Deck]:
    today = await _today(db)
    rows = await db.execute(_DECKS, {"today": today, "sid": subject_id})
    return [Deck(**row) for row in rows.mappings()]


class DeckCard(BaseModel):
    id: UUID
    front: str
    back: str
    mastered: bool


@router.get("/decks/{deck_id}/cards")
async def deck_cards(deck_id: UUID, db: UserDb) -> list[DeckCard]:
    """Every card in one of your decks, to flip through whether or not it is due."""
    rows = await db.execute(
        text(
            "select id, term as front, definition as back, repetitions >= 3 as mastered "
            "from flashcards where deck_id = :id order by created_at"
        ),
        {"id": deck_id},
    )
    return [DeckCard(**row) for row in rows.mappings()]


@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(deck_id: UUID, db: UserDb) -> None:
    deleted = (
        await db.execute(
            text("delete from flashcard_decks where id = :id returning 1"), {"id": deck_id}
        )
    ).first()
    if deleted is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found.")


_DUE_COUNT = text(
    "select count(*) from flashcards where (next_review is null or next_review <= :today) "
    "and (cast(:sid as uuid) is null or subject_id = :sid) "
    "and (cast(:deck as uuid) is null or deck_id = :deck)"
)
_DUE_CARDS = text(
    "select id, deck_id, subject_id, term as front, definition as back, repetitions, "
    "interval_days from flashcards where (next_review is null or next_review <= :today) "
    "and (cast(:sid as uuid) is null or subject_id = :sid) "
    "and (cast(:deck as uuid) is null or deck_id = :deck) "
    "order by next_review nulls last, created_at limit :limit"
)


@router.get("/due")
async def due_cards(
    db: UserDb, subject_id: UUID | None = None, deck_id: UUID | None = None, limit: int = 20
) -> DueQueue:
    """Cards to review today (optionally from one deck): overdue first, new cards last, plus the
    study streak."""
    today = await _today(db)
    params = {"today": today, "sid": subject_id, "deck": deck_id, "limit": max(1, min(limit, 100))}
    total = (await db.execute(_DUE_COUNT, params)).scalar_one()
    rows = await db.execute(_DUE_CARDS, params)
    streak, reviewed_today = await _streak(db, today)
    return DueQueue(
        today=today,
        due_total=total,
        cards=[DueCard(**row) for row in rows.mappings()],
        streak_days=streak,
        reviewed_today=reviewed_today,
    )


@router.post("/{card_id}/review")
async def review_card(card_id: UUID, body: ReviewIn, db: UserDb) -> Reviewed:
    """Again / Hard / Good / Easy: SM-2 decides when the card comes back."""
    card = (
        (
            await db.execute(
                text(
                    "select ease_factor, interval_days, repetitions, next_review "
                    "from flashcards where id = :id for update"
                ),
                {"id": card_id},
            )
        )
        .mappings()
        .first()
    )
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.")
    today = await _today(db)
    after = review(Schedule(**card), body.rating, today)
    await db.execute(
        text(
            "update flashcards set ease_factor = :ease, interval_days = :interval, "
            "repetitions = :reps, next_review = :next where id = :id"
        ),
        {
            "ease": after.ease_factor,
            "interval": after.interval_days,
            "reps": after.repetitions,
            "next": after.next_review,
            "id": card_id,
        },
    )
    await db.execute(
        text(
            "insert into flashcard_reviews (flashcard_id, rating, reviewed_on) "
            "values (:id, :rating, :today)"
        ),
        {"id": card_id, "rating": body.rating.value, "today": today},
    )
    streak, _ = await _streak(db, today)
    return Reviewed(
        id=card_id,
        rating=body.rating,
        ease_factor=after.ease_factor,
        interval_days=after.interval_days,
        repetitions=after.repetitions,
        next_review=after.next_review,
        streak_days=streak,
    )
