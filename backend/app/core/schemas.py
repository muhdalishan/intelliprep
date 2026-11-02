from pydantic import BaseModel, Field

MAX_NOTES_CHARS = 60_000  # about 15k tokens; keeps one request's cost bounded


class NotesRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_NOTES_CHARS, description="The student's notes")
    focus: str | None = Field(
        default=None, max_length=500, description="Optional topic to focus on"
    )
