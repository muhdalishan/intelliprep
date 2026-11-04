from pydantic import BaseModel, Field

MAX_NOTES_CHARS = 60_000  # about 15k tokens; keeps one request's cost bounded


class NotesRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_NOTES_CHARS, description="The student's notes")
    focus: str | None = Field(
        default=None, max_length=500, description="Optional topic to focus on"
    )


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
