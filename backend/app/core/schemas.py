from typing import Self

from pydantic import BaseModel, Field, model_validator

MAX_NOTES_CHARS = 60_000  # about 15k tokens; keeps one request's cost bounded


class NotesRequest(BaseModel):
    """Notes to work from, a topic to focus on, or both (a topic alone is allowed)."""

    text: str = Field(default="", max_length=MAX_NOTES_CHARS, description="The student's notes")
    focus: str | None = Field(
        default=None,
        max_length=500,
        description="Topic to focus on, or to teach when there are no notes",
    )

    @model_validator(mode="after")
    def _notes_or_topic(self) -> Self:
        if not self.text.strip() and not (self.focus and self.focus.strip()):
            raise ValueError("Attach notes or type a topic.")
        return self


class MultipleChoice(BaseModel):
    """One multiple-choice question, as quizzes and the adaptive exam generate it."""

    question: str
    options: list[str]
    correct_index: int
    explanation: str
    topic: str


def is_well_formed(q: MultipleChoice) -> bool:
    """Exactly 4 different options, a valid answer and some question text."""
    return (
        bool(q.question.strip())
        and len(q.options) == 4
        and len({o.strip().lower() for o in q.options}) == 4
        and 0 <= q.correct_index < 4
    )
