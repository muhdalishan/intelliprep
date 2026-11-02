"""Flashcard generation and SM-2 spaced-repetition review (due queue, rating, streak).

Generation works on the text the student sends; saving decks and the review queue arrive with
the flashcards table (IP-51).

Backlog: IP-41, IP-50, IP-51 (docs/scrum/product-backlog.md)
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core import llm
from app.core.schemas import NotesRequest
from app.core.security import CurrentUser, get_current_user

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


@router.post("/generate")
async def generate_flashcards(
    body: FlashcardsRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> FlashcardsResponse:
    focus = f"Focus on: {body.focus}\n" if body.focus else ""
    prompt = f"Make exactly {body.count} flashcards.\n{focus}\n{llm.as_notes(body.text)}"
    deck = await llm.generate_structured(INSTRUCTIONS, prompt, _Deck)
    cards = [c for c in deck.cards if c.front.strip() and c.back.strip()][: body.count]
    if not cards:
        raise llm.AIUnavailable("No flashcards could be made from this text. Try longer notes.")
    return FlashcardsResponse(cards=cards)
