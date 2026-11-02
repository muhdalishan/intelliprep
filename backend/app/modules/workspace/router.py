"""Subjects, Kanban tasks and Moodboard notes.

A subject's planner and board are shared by everyone who can access the subject: its owner and
the members of any group it's shared with. Personal data (flashcards, reminders) lives elsewhere.

Backlog: IP-14, IP-100, IP-101 (docs/scrum/product-backlog.md)
"""

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db.errors import db_errors
from app.db.session import UserDb

router = APIRouter(prefix="/workspace", tags=["workspace"])

TaskStatus = Literal["todo", "learning", "practiced", "mastered"]


class SubjectOut(BaseModel):
    id: UUID
    name: str
    instructor: str | None
    credits: int | None
    exam_date: date | None
    owned: bool
    shared_in: list[str]
    """Names of the groups this subject is shared with (that the caller belongs to)."""


class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    instructor: str | None = Field(default=None, max_length=120)
    credits: int | None = Field(default=None, ge=1, le=6)
    exam_date: date | None = None


class Task(BaseModel):
    id: UUID
    subject_id: UUID
    title: str
    status: TaskStatus
    created_by: UUID


class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    status: TaskStatus = "todo"


class TaskPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: TaskStatus | None = None


class Note(BaseModel):
    id: UUID
    subject_id: UUID
    content: str
    color: str
    x: int
    y: int
    created_by: UUID


class NoteIn(BaseModel):
    content: str = Field(max_length=2_000)
    color: str = Field(default="bg-yellow-200", max_length=40)
    x: int = Field(default=100, ge=0, le=5_000)
    y: int = Field(default=100, ge=0, le=5_000)


class NotePatch(BaseModel):
    content: str | None = Field(default=None, max_length=2_000)
    color: str | None = Field(default=None, max_length=40)
    x: int | None = Field(default=None, ge=0, le=5_000)
    y: int | None = Field(default=None, ge=0, le=5_000)


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found.")


# Subjects --------------------------------------------------------------------


@router.get("/subjects")
async def list_subjects(db: UserDb) -> list[SubjectOut]:
    rows = await db.execute(
        text(
            "select s.id, s.name, s.instructor, s.credits, s.exam_date, "
            "s.user_id = (select auth.uid()) as owned, "
            "coalesce(array(select g.name from group_subjects gs "
            "  join study_groups g on g.id = gs.group_id where gs.subject_id = s.id "
            "  order by g.name), '{}') as shared_in "
            "from subjects s order by s.exam_date nulls last, s.name"
        )
    )
    return [SubjectOut(**row) for row in rows.mappings()]


@router.post("/subjects", status_code=status.HTTP_201_CREATED)
async def create_subject(body: SubjectIn, db: UserDb) -> SubjectOut:
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        "insert into subjects (name, instructor, credits, exam_date) "
                        "values (:name, :instructor, :credits, :exam_date) "
                        "returning id, name, instructor, credits, exam_date"
                    ),
                    body.model_dump(),
                )
            )
            .mappings()
            .one()
        )
    return SubjectOut(**row, owned=True, shared_in=[])


# Shared planner --------------------------------------------------------------


@router.get("/subjects/{subject_id}/tasks")
async def list_tasks(subject_id: UUID, db: UserDb) -> list[Task]:
    rows = await db.execute(
        text(
            "select id, subject_id, title, status, created_by from subject_tasks "
            "where subject_id = :sid order by position, created_at"
        ),
        {"sid": subject_id},
    )
    return [Task(**row) for row in rows.mappings()]


@router.post("/subjects/{subject_id}/tasks", status_code=status.HTTP_201_CREATED)
async def add_task(subject_id: UUID, body: TaskIn, db: UserDb) -> Task:
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        "insert into subject_tasks (subject_id, title, status) "
                        "values (:sid, :title, :status) "
                        "returning id, subject_id, title, status, created_by"
                    ),
                    {"sid": subject_id, "title": body.title.strip(), "status": body.status},
                )
            )
            .mappings()
            .one()
        )
    return Task(**row)


@router.patch("/tasks/{task_id}")
async def update_task(task_id: UUID, body: TaskPatch, db: UserDb) -> Task:
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Nothing to change."
        )
    assignments = ", ".join(f"{column} = :{column}" for column in changes)  # columns from the model
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        f"update subject_tasks set {assignments} where id = :id "  # noqa: S608
                        "returning id, subject_id, title, status, created_by"
                    ),
                    {**changes, "id": task_id},
                )
            )
            .mappings()
            .first()
        )
    if row is None:
        raise _not_found("Task")
    return Task(**row)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: UUID, db: UserDb) -> None:
    deleted = (
        await db.execute(
            text("delete from subject_tasks where id = :id returning 1"), {"id": task_id}
        )
    ).first()
    if deleted is None:
        raise _not_found("Task")


# Shared board ----------------------------------------------------------------


@router.get("/subjects/{subject_id}/notes")
async def list_notes(subject_id: UUID, db: UserDb) -> list[Note]:
    rows = await db.execute(
        text(
            "select id, subject_id, content, color, x, y, created_by from board_notes "
            "where subject_id = :sid order by created_at"
        ),
        {"sid": subject_id},
    )
    return [Note(**row) for row in rows.mappings()]


@router.post("/subjects/{subject_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_note(subject_id: UUID, body: NoteIn, db: UserDb) -> Note:
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        "insert into board_notes (subject_id, content, color, x, y) "
                        "values (:sid, :content, :color, :x, :y) "
                        "returning id, subject_id, content, color, x, y, created_by"
                    ),
                    {"sid": subject_id, **body.model_dump()},
                )
            )
            .mappings()
            .one()
        )
    return Note(**row)


@router.patch("/notes/{note_id}")
async def update_note(note_id: UUID, body: NotePatch, db: UserDb) -> Note:
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Nothing to change."
        )
    assignments = ", ".join(f"{column} = :{column}" for column in changes)  # columns from the model
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        f"update board_notes set {assignments} where id = :id "  # noqa: S608
                        "returning id, subject_id, content, color, x, y, created_by"
                    ),
                    {**changes, "id": note_id},
                )
            )
            .mappings()
            .first()
        )
    if row is None:
        raise _not_found("Note")
    return Note(**row)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: UUID, db: UserDb) -> None:
    deleted = (
        await db.execute(
            text("delete from board_notes where id = :id returning 1"), {"id": note_id}
        )
    ).first()
    if deleted is None:
        raise _not_found("Note")
