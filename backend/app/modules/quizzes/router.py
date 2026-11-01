"""MCQ generation, quiz sessions, scoring and weak-topic logging.

Backlog: IP-42 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/quiz", tags=["quizzes"])
