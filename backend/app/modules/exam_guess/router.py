"""Exam-Guess engine: past papers, question clustering, ranked topic predictions.

Backlog: IP-60, IP-61, IP-62 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/exam-guess", tags=["exam-guess"])
