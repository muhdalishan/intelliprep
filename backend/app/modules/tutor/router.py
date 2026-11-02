"""The study tutor: a companion the student types or talks to, who answers like a teacher.

Answers use the notes the student has open; retrieval over all their documents (IP-34) and
actions such as reminders and notes (IP-142) come later.

Backlog: IP-140, IP-141, IP-142 (docs/scrum/product-backlog.md)
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core import llm
from app.core.security import CurrentUser, get_current_user

router = APIRouter(prefix="/tutor", tags=["tutor"])

TEXT_STYLE = """You are IntelliPrep's study tutor for a university student in Pakistan. Talk like a
patient, encouraging teacher: explain step by step, check understanding with a quick question
when useful, and give memory hooks for hard ideas. When notes are provided, base your answer on
them and say when something isn't in the notes. Keep answers focused; use short paragraphs and
bullet points where they help."""

VOICE_STYLE = """You are IntelliPrep's study tutor in a live spoken conversation with a university
student. Speak naturally, like a friendly teacher sitting beside them: one to three short
sentences, no lists, no markdown, no symbols that sound odd when read aloud. Ask a follow-up
question when it helps them think. When notes are provided, base your answer on them."""


class ChatTurn(BaseModel):
    role: Literal["user", "model"]
    text: str = Field(max_length=8_000)


class TutorRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=30)
    subject: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=20_000)
    voice: bool = False


class TutorResponse(BaseModel):
    reply: str


@router.post("/chat")
async def chat(
    body: TutorRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> TutorResponse:
    instructions = VOICE_STYLE if body.voice else TEXT_STYLE
    if body.subject:
        instructions += f"\n\nThe student is studying {body.subject}."
    messages: list[llm.Message] = []
    if body.notes:
        messages.append({"role": "user", "content": llm.as_notes(body.notes)})
    messages += [
        {"role": "assistant" if turn.role == "model" else "user", "content": turn.text}
        for turn in body.history[-20:]
    ]
    messages.append({"role": "user", "content": body.message})
    reply = await llm.generate_text(
        instructions, messages, max_output_tokens=1500 if body.voice else 4000
    )
    return TutorResponse(reply=reply)
