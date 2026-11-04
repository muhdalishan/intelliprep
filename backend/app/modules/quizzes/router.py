"""MCQ generation, quiz sessions, scoring and weak-topic logging.

Generation works on the text the student sends; scoring and weak-topic logging move to the
server with the quiz tables.

Backlog: IP-42 (docs/scrum/product-backlog.md)
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core import llm
from app.core.schemas import MultipleChoice, NotesRequest, is_well_formed
from app.core.security import CurrentUser, get_current_user

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


@router.post("/generate")
async def generate_quiz(
    body: QuizRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> QuizResponse:
    focus = f"Focus on: {body.focus}\n" if body.focus else ""
    prompt = f"Write exactly {body.count} questions.\n{focus}\n{llm.as_notes(body.text)}"
    result = await llm.generate_structured(INSTRUCTIONS, prompt, _QuestionSet)
    questions = [q for q in result.questions if is_well_formed(q)][: body.count]
    if not questions:
        raise llm.AIUnavailable("No questions could be made from this text. Try longer notes.")
    return QuizResponse(questions=questions)
