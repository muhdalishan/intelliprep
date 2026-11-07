"""Adaptive exam simulator: weak-topic question bank and live difficulty adjustment.

The app keeps the session's history and asks for one question at a time; the rules in engine.py
pick the level and the topic, and the AI writes a question at that level from the student's
notes. The correct answer travels back to the browser only inside a sealed (encrypted) token, so it
can't be read before the student answers: POST /answer checks the choice and reveals it.

Backlog: IP-70, IP-71 (docs/scrum/product-backlog.md)
"""

import hashlib
import random
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core import llm, tokens
from app.core.schemas import MultipleChoice, NotesRequest, is_well_formed
from app.core.security import CurrentUser, get_current_user
from app.core.usage import AIQuota
from app.modules.adaptive_exam.engine import (
    Answered,
    Level,
    WeakTopic,
    breakdown,
    current_level,
    focus_topic,
    highest_level,
)

router = APIRouter(prefix="/adaptive-exam", tags=["adaptive-exam"])

ANSWER_TTL_SECONDS = 2 * 60 * 60

LEVEL_GUIDE: dict[Level, str] = {
    "easy": "Easy: recall of one definition or fact stated directly in the notes.",
    "medium": "Medium: understanding; explain or recognise an idea in slightly different words.",
    "hard": "Hard: apply an idea from the notes to a new example or small calculation.",
    "very_hard": (
        "Very hard: multi-step reasoning, comparing two ideas, or spotting a subtle mistake; "
        "distractors are close to the right answer."
    ),
}

INSTRUCTIONS = """You write multiple-choice exam questions from a university student's notes, at a
requested difficulty. Each question has exactly 4 options with one correct answer. Wrong options
are plausible mistakes a student could make. The explanation says why the correct option is right.
Topic is a short name (2-5 words) for the idea tested. Only use facts in the notes, and never
repeat a question the student has already seen."""


class HistoryItem(BaseModel):
    topic: str = Field(max_length=120)
    level: Level
    correct: bool


class WeakTopicIn(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    misses: int = Field(default=1, ge=1, le=100)


class NextRequest(NotesRequest):
    history: list[HistoryItem] = Field(default_factory=list, max_length=60)
    weak_topics: list[WeakTopicIn] = Field(default_factory=list, max_length=20)
    previous_questions: list[str] = Field(default_factory=list, max_length=60)


class QuestionOut(BaseModel):
    question: str
    options: list[str]
    topic: str


class NextResponse(BaseModel):
    level: Level
    focus_topic: str | None
    question: QuestionOut
    token: str
    """Encrypted; send it back with the answer. The browser can't read the correct option."""


class AnswerRequest(BaseModel):
    token: str = Field(max_length=8_000)
    chosen_index: int = Field(ge=0, le=3)


class AnswerResponse(BaseModel):
    correct: bool
    correct_index: int
    explanation: str
    topic: str
    level: Level


class SummaryRequest(BaseModel):
    history: list[HistoryItem] = Field(min_length=1, max_length=60)


class TopicScore(BaseModel):
    topic: str
    correct: int
    total: int


class SummaryResponse(BaseModel):
    score: int
    total: int
    final_level: Level
    highest_level: Level
    topics: list[TopicScore]


class _Candidates(BaseModel):
    questions: list[MultipleChoice]


def _answers(history: list[HistoryItem]) -> list[Answered]:
    return [Answered(h.topic, h.level, h.correct) for h in history]


def _fingerprint(question: str) -> str:
    return hashlib.sha256(" ".join(question.lower().split()).encode()).hexdigest()


@router.post("/next", dependencies=[AIQuota])
async def next_question(
    body: NextRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> NextResponse:
    level = current_level(_answers(body.history))
    weak = [WeakTopic(w.topic, w.misses) for w in body.weak_topics]
    topic = focus_topic(weak, random.Random())  # noqa: S311 (choosing a topic, not security)

    seen = "\n".join(f"- {q[:300]}" for q in body.previous_questions)
    prompt = (
        f"Difficulty: {LEVEL_GUIDE[level]}\n"
        + (f"Test this weak topic: {topic}\n" if topic else "Pick any topic from the notes.\n")
        + (f"Questions already asked (don't repeat):\n{seen}\n" if seen else "")
        + f"Write 2 candidate questions.\n\n{llm.as_notes(body.text)}"
    )
    result = await llm.generate_structured(INSTRUCTIONS, prompt, _Candidates)

    seen_prints = {_fingerprint(q) for q in body.previous_questions}
    usable = [
        q
        for q in result.questions
        if is_well_formed(q) and _fingerprint(q.question) not in seen_prints
    ]
    if not usable:
        raise llm.AIUnavailable("Couldn't write a new question from these notes. Try again.")
    question = usable[0]

    token = tokens.seal(
        {"c": question.correct_index, "e": question.explanation, "t": question.topic, "l": level}
    )
    return NextResponse(
        level=level,
        focus_topic=topic,
        question=QuestionOut(
            question=question.question, options=question.options, topic=question.topic
        ),
        token=token,
    )


@router.post("/answer")
async def check_answer(
    body: AnswerRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> AnswerResponse:
    try:
        payload = tokens.unseal(body.token, ANSWER_TTL_SECONDS)
    except tokens.InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This question has expired. Get a new question to continue.",
        ) from exc
    return AnswerResponse(
        correct=body.chosen_index == payload["c"],
        correct_index=payload["c"],
        explanation=payload["e"],
        topic=payload["t"],
        level=payload["l"],
    )


@router.post("/summary")
async def summary(
    body: SummaryRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> SummaryResponse:
    answers = _answers(body.history)
    return SummaryResponse(
        score=sum(a.correct for a in answers),
        total=len(answers),
        final_level=current_level(answers),
        highest_level=highest_level(answers),
        topics=[
            TopicScore(topic=r.topic, correct=r.correct, total=r.total) for r in breakdown(answers)
        ],
    )
