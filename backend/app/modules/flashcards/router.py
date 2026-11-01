"""Flashcard generation and SM-2 spaced-repetition review (due queue, rating, streak).

Backlog: IP-41, IP-50, IP-51 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/flashcards", tags=["flashcards"])
