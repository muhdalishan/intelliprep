"""The study assistant ("Hey Nova"): one assistant for typed and spoken messages.

It answers study questions like a tutor (in full when typed, in a few sentences when spoken) and
lists actions (save a note, set a reminder, add a task, open a section). The app carries the
actions out; the server only decides and validates them.
"""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core import llm
from app.core.security import CurrentUser, get_current_user
from app.core.usage import AIQuota

router = APIRouter(prefix="/assistant", tags=["assistant"])

Section = Literal[
    "dashboard",
    "overview",
    "upload",
    "summary",
    "diagrams",
    "flashcards",
    "quiz",
    "exam",
    "weak-topics",
    "guess-engine",
    "studyroom",
    "kanban",
    "moodboard",
    "reminders",
]


class Action(BaseModel):
    type: Literal["add_note", "set_reminder", "add_task", "open_section"]
    subject_id: str | None
    title: str | None
    content: str | None
    due: str | None
    """Local date and time for reminders, YYYY-MM-DDTHH:MM."""
    section: Section | None


class _Decision(BaseModel):
    reply: str
    actions: list[Action]


class SubjectRef(BaseModel):
    id: str = Field(max_length=64)
    name: str = Field(max_length=120)


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4_000)


class CommandRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2_000)
    assistant_name: str = Field(default="Nova", min_length=1, max_length=30)
    now: str = Field(description="The student's local date and time, e.g. 2026-11-02T21:15 Mon")
    subjects: list[SubjectRef] = Field(default_factory=list, max_length=50)
    current_subject_id: str | None = Field(default=None, max_length=64)
    history: list[Turn] = Field(default_factory=list, max_length=12)
    voice: bool = Field(default=False, description="Spoken to: the reply is read aloud")


class CommandResponse(BaseModel):
    reply: str
    actions: list[Action]
    skipped: list[str]
    """Actions the model proposed that couldn't be carried out, in plain words."""


SPOKEN = """The student is talking to you out loud and your reply is read aloud: one to three
short spoken sentences, no lists, no markdown, no emoji. Ask a follow-up question when it helps."""

TYPED = """The student typed this. For study questions, answer like a patient, encouraging
teacher: explain step by step, give an example or a memory hook for hard ideas, and check
understanding with a quick question when useful. Use short paragraphs, '-' bullets, numbered
steps and **bold** for key terms; no headings, no emoji. For requests that are only actions,
reply in one sentence."""


def _instructions(name: str, voice: bool) -> str:
    return f"""You are {name}, a university student's personal study assistant and tutor, for
students in Pakistan preparing for exams.
{SPOKEN if voice else TYPED}

You can do things for the student by adding actions:
- add_note: save a note (title + content) to a subject's board.
- set_reminder: a reminder with a message in title and a due local time as YYYY-MM-DDTHH:MM.
  Resolve words like "tomorrow", "tonight", "in 2 hours" or "Friday at 9" from the current time.
  If no time is given, ask for one instead of guessing.
- add_task: add a study task (title) to a subject's plan.
- open_section: take the student to a section; use subject_id for subject sections, or the
  "dashboard" section for the home screen.
Use subject_id only from the subject list. If the student doesn't name a subject, use the current
subject; if there is none and one is needed, ask which subject. When you do something, confirm it
briefly in the reply ("Done, I'll remind you tomorrow at 9."). Never claim to do anything that isn't
in actions. If the student just asks a study question, answer it with no actions.
Fill fields an action doesn't use with null."""


def _validate(
    actions: list[Action], subject_ids: set[str], now: datetime | None
) -> tuple[list[Action], list[str]]:
    kept: list[Action] = []
    skipped: list[str] = []
    for action in actions:
        if action.subject_id not in subject_ids:
            action = action.model_copy(update={"subject_id": None})
        if action.type == "set_reminder":
            try:
                due = datetime.fromisoformat(action.due or "")
            except ValueError:
                skipped.append("A reminder had no clear time, so it wasn't set.")
                continue
            if now and due < now:
                skipped.append("A reminder time was already in the past, so it wasn't set.")
                continue
            action = action.model_copy(update={"due": due.strftime("%Y-%m-%dT%H:%M")})
        if (
            action.type in ("add_note", "add_task", "set_reminder")
            and not (action.title or "").strip()
        ):
            skipped.append(f"A {action.type.replace('_', ' ')} had no text, so it was skipped.")
            continue
        if action.type in ("add_note", "add_task") and action.subject_id is None:
            skipped.append(f"I didn't know which subject to {action.type.replace('_', ' ')} to.")
            continue
        if action.type == "open_section" and action.section is None:
            continue
        kept.append(action)
    return kept, skipped


@router.post("/command", dependencies=[AIQuota])
async def command(
    body: CommandRequest, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> CommandResponse:
    subjects = "\n".join(f"- id {s.id}: {s.name}" for s in body.subjects) or "(no subjects yet)"
    current = next((s.name for s in body.subjects if s.id == body.current_subject_id), None)
    context = (
        f"Current local time: {body.now}\n"
        f"Current subject: {f'{current} (id {body.current_subject_id})' if current else 'none'}\n"
        f"Subjects:\n{subjects}"
    )
    conversation = "\n".join(
        f"{'Student' if t.role == 'user' else body.assistant_name}: {t.text}"
        for t in body.history[-8:]
    )
    prompt = (
        f"{context}\n\nRecent conversation:\n{conversation or '(none)'}\n\nStudent: {body.message}"
    )

    decision = await llm.generate_structured(
        _instructions(body.assistant_name, body.voice), prompt, _Decision
    )

    try:
        now = datetime.fromisoformat(body.now.split(" ")[0])
    except ValueError:
        now = None
    actions, skipped = _validate(decision.actions, {s.id for s in body.subjects}, now)
    return CommandResponse(reply=decision.reply, actions=actions, skipped=skipped)
