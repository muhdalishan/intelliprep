"""Summary generation grounded in retrieved chunks, with saved history.

Until document storage and retrieval land (IP-20..31), summaries are generated from the text the
student sends. Saved history comes with the summaries table.

Backlog: IP-40 (docs/scrum/product-backlog.md)
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core import llm
from app.core.schemas import NotesRequest
from app.core.security import CurrentUser, get_current_user

router = APIRouter(prefix="/summary", tags=["summaries"])

INSTRUCTIONS = """You write revision summaries for university students in Pakistan preparing for
exams.
Summarise only what is in the student's notes; do not add facts the notes don't contain.
Structure: a one-line overview, then each main topic as a heading with its sub-topics and the key
points, definitions and formulas as short bullets. Use plain text with '#' headings and '-' bullets.
Keep formulas exactly as written in the notes."""


class SummaryResponse(BaseModel):
    summary: str


@router.post("/generate")
async def generate_summary(
    body: NotesRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> SummaryResponse:
    focus = f"Focus on: {body.focus}\n\n" if body.focus else ""
    summary = await llm.generate_text(INSTRUCTIONS, focus + llm.as_notes(body.text))
    return SummaryResponse(summary=summary)
