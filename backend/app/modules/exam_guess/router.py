"""Exam-Guess engine: past papers, question clustering, ranked topic predictions.

The real engine ranks topics from the student's own past papers (ranking.py, IP-60/61).
Until past-paper upload exists, /guess gives a notes-based estimate the UI labels as such.

Backlog: IP-60, IP-61, IP-62 (docs/scrum/product-backlog.md)
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core import llm
from app.core.security import CurrentUser, get_current_user

router = APIRouter(prefix="/exam-guess", tags=["exam-guess"])

INSTRUCTIONS = """You help a university student in Pakistan prepare for a final exam.
From the course notes, estimate which topics are most likely to be examined and how heavily,
based on how central and how much covered each topic is in the notes. Be honest that this is an
estimate from notes, not from past papers. Sample questions should match university exam style
(long answer, short answer, problem solving) and come with an answer outline.
Probability must be High, Medium or Low. Weights are percentages that add up to about 100."""


class Prediction(BaseModel):
    topic: str
    probability: Literal["High", "Medium", "Low"]
    reason: str
    estimatedWeight: str  # noqa: N815 - matches the frontend's field name


class SampleQuestion(BaseModel):
    question: str
    format: str
    suggestedStructure: str  # noqa: N815


class GuessResponse(BaseModel):
    predictions: list[Prediction]
    sampleQuestions: list[SampleQuestion]  # noqa: N815
    strategicAdvice: str  # noqa: N815


class GuessRequest(BaseModel):
    subject_name: str = Field(min_length=1, max_length=120)
    text: str = Field(default="", max_length=60_000)
    focus: str | None = Field(default=None, max_length=500)


@router.post("/guess")
async def guess_from_notes(
    body: GuessRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> GuessResponse:
    notes = llm.as_notes(body.text) if body.text.strip() else "(no notes provided yet)"
    focus = f"Focus on: {body.focus}\n" if body.focus else ""
    prompt = (
        f"Subject: {body.subject_name}\n{focus}"
        "Give 4-6 predicted topics, 2-3 sample questions and short strategic advice.\n\n"
        f"{notes}"
    )
    return await llm.generate_structured(INSTRUCTIONS, prompt, GuessResponse)
