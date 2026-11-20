"""Study groups: create or join with an invite code, share subjects, chat with files.

Access rules live in the database (migration 20261103000000_study_groups.sql); these endpoints
run as the calling student, so a request can never see or change more than the policies allow.

Backlog: IP-90, IP-91 (docs/scrum/product-backlog.md)
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db.errors import db_errors
from app.db.session import UserDb

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupSummary(BaseModel):
    id: UUID
    name: str
    invite_code: str
    role: str
    member_count: int
    subject_count: int


class Member(BaseModel):
    user_id: UUID
    full_name: str
    avatar_url: str | None
    role: str
    joined_at: datetime


class SharedSubject(BaseModel):
    id: UUID
    name: str
    exam_date: str | None
    shared_by: UUID
    shared_by_name: str


class GroupDetail(BaseModel):
    id: UUID
    name: str
    invite_code: str
    role: str
    members: list[Member]
    subjects: list[SharedSubject]


class Attachment(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size_bytes: int


class Message(BaseModel):
    id: int
    user_id: UUID
    author: str
    body: str
    created_at: datetime
    attachments: list[Attachment] = Field(default_factory=list)


class CreateGroup(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class JoinGroup(BaseModel):
    invite_code: str = Field(min_length=4, max_length=16)


class ShareSubject(BaseModel):
    subject_id: UUID


class PostMessage(BaseModel):
    body: str = Field(min_length=1, max_length=2_000)


async def _detail(db: UserDb, group_id: UUID) -> GroupDetail:
    group = (
        (
            await db.execute(
                text(
                    "select g.id, g.name, g.invite_code, m.role from study_groups g "
                    "join group_members m on m.group_id = g.id and m.user_id = (select auth.uid()) "
                    "where g.id = :gid"
                ),
                {"gid": group_id},
            )
        )
        .mappings()
        .first()
    )
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")
    members = [
        Member(**row)
        for row in (
            await db.execute(text("select * from group_member_list(:gid)"), {"gid": group_id})
        ).mappings()
    ]
    names = {m.user_id: m.full_name for m in members}
    subjects = [
        SharedSubject(
            id=row["id"],
            name=row["name"],
            exam_date=row["exam_date"].isoformat() if row["exam_date"] else None,
            shared_by=row["shared_by"],
            shared_by_name=names.get(row["shared_by"], "A former member"),
        )
        for row in (
            await db.execute(
                text(
                    "select s.id, s.name, s.exam_date, gs.shared_by from group_subjects gs "
                    "join subjects s on s.id = gs.subject_id where gs.group_id = :gid "
                    "order by gs.shared_at"
                ),
                {"gid": group_id},
            )
        ).mappings()
    ]
    return GroupDetail(**group, members=members, subjects=subjects)


@router.get("")
async def list_groups(db: UserDb) -> list[GroupSummary]:
    rows = await db.execute(
        text(
            "select g.id, g.name, g.invite_code, m.role, "
            "(select count(*) from group_members x where x.group_id = g.id) as member_count, "
            "(select count(*) from group_subjects s where s.group_id = g.id) as subject_count "
            "from study_groups g "
            "join group_members m on m.group_id = g.id and m.user_id = (select auth.uid()) "
            "order by g.created_at"
        )
    )
    return [GroupSummary(**row) for row in rows.mappings()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_group(body: CreateGroup, db: UserDb) -> GroupDetail:
    with db_errors():
        group_id = (
            await db.execute(
                text("insert into study_groups (name) values (:name) returning id"),
                {"name": body.name.strip()},
            )
        ).scalar_one()
    return await _detail(db, group_id)


@router.post("/join")
async def join_group(body: JoinGroup, db: UserDb) -> GroupDetail:
    with db_errors():
        group_id = (
            await db.execute(text("select join_group(:code)"), {"code": body.invite_code})
        ).scalar_one()
    return await _detail(db, group_id)


@router.get("/{group_id}")
async def get_group(group_id: UUID, db: UserDb) -> GroupDetail:
    return await _detail(db, group_id)


@router.post("/{group_id}/subjects", status_code=status.HTTP_201_CREATED)
async def share_subject(group_id: UUID, body: ShareSubject, db: UserDb) -> GroupDetail:
    with db_errors():
        await db.execute(
            text("insert into group_subjects (group_id, subject_id) values (:gid, :sid)"),
            {"gid": group_id, "sid": body.subject_id},
        )
    return await _detail(db, group_id)


@router.delete("/{group_id}/subjects/{subject_id}")
async def unshare_subject(group_id: UUID, subject_id: UUID, db: UserDb) -> GroupDetail:
    removed = (
        await db.execute(
            text(
                "delete from group_subjects where group_id = :gid and subject_id = :sid returning 1"
            ),
            {"gid": group_id, "sid": subject_id},
        )
    ).first()
    if removed is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the student who shared it, or the group lead, can unshare a subject.",
        )
    return await _detail(db, group_id)


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(group_id: UUID, db: UserDb) -> None:
    await db.execute(text("select leave_group(:gid)"), {"gid": group_id})


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(group_id: UUID, user_id: UUID, db: UserDb) -> GroupDetail:
    removed = (
        await db.execute(
            text("delete from group_members where group_id = :gid and user_id = :uid returning 1"),
            {"gid": group_id, "uid": user_id},
        )
    ).first()
    if removed is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only the group lead can remove members."
        )
    return await _detail(db, group_id)


@router.get("/{group_id}/messages")
async def list_messages(
    group_id: UUID, db: UserDb, after: int = Query(default=0, ge=0)
) -> list[Message]:
    rows = await db.execute(
        text(
            "select m.id, m.user_id, coalesce(l.full_name, 'A former member') as author, "
            "m.body, m.created_at from group_messages m "
            "left join group_member_list(:gid) l on l.user_id = m.user_id "
            "where m.group_id = :gid and m.id > :after order by m.id desc limit 100"
        ),
        {"gid": group_id, "after": after},
    )
    messages = [Message(**row) for row in reversed(rows.mappings().all())]
    if messages:
        files = await db.execute(
            text(
                "select id, message_id, filename, content_type, size_bytes from group_attachments "
                "where group_id = :gid and message_id = any(:ids) order by created_at"
            ),
            {"gid": group_id, "ids": [m.id for m in messages]},
        )
        by_message: dict[int, list[Attachment]] = {}
        for row in files.mappings():
            by_message.setdefault(row["message_id"], []).append(Attachment(**row))
        for message in messages:
            message.attachments = by_message.get(message.id, [])
    return messages


@router.post("/{group_id}/messages", status_code=status.HTTP_201_CREATED)
async def post_message(group_id: UUID, body: PostMessage, db: UserDb) -> Message:
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        "insert into group_messages (group_id, body) values (:gid, :body) "
                        "returning id, user_id, body, created_at"
                    ),
                    {"gid": group_id, "body": body.body.strip()},
                )
            )
            .mappings()
            .one()
        )
    author = (
        await db.execute(
            text("select full_name from group_member_list(:gid) where user_id = :uid"),
            {"gid": group_id, "uid": row["user_id"]},
        )
    ).scalar_one_or_none()
    return Message(**row, author=author or "You")


# Files in the chat --------------------------------------------------------------------------

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES = 6

# What the chat accepts. Anything a browser would run (HTML, SVG, scripts) is refused.
ALLOWED_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf",
    "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm",
    "video/mp4", "video/webm", "video/quicktime",
    "text/plain", "text/markdown", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip", "application/x-zip-compressed",
}

# Browsers sometimes send a generic type; fall back to the file extension.
BY_EXTENSION = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif",
    "webp": "image/webp", "pdf": "application/pdf", "mp3": "audio/mpeg", "m4a": "audio/mp4",
    "wav": "audio/wav", "ogg": "audio/ogg", "mp4": "video/mp4", "webm": "video/webm",
    "mov": "video/quicktime", "txt": "text/plain", "md": "text/markdown", "csv": "text/csv",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "zip": "application/zip",
}


def _file_type(file: UploadFile) -> str:
    declared = (file.content_type or "").split(";")[0].strip().lower()
    if declared in ALLOWED_TYPES:
        return declared
    extension = (file.filename or "").rsplit(".", 1)[-1].lower()
    guessed = BY_EXTENSION.get(extension)
    if guessed:
        return guessed
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail=f"{file.filename or 'This file'} can't be shared here. Send photos, PDFs, audio, "
        "video, Office documents, text or zip files.",
    )


@router.post("/{group_id}/messages/files", status_code=status.HTTP_201_CREATED)
async def post_files(
    group_id: UUID,
    db: UserDb,
    files: Annotated[list[UploadFile], File()],
    body: Annotated[str, Form(max_length=2_000)] = "",
) -> Message:
    """Posts a message with up to six files (10 MB each) and an optional caption."""
    if not files or len(files) > MAX_FILES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Attach between 1 and {MAX_FILES} files.",
        )
    prepared = []
    for file in files:
        kind = _file_type(file)
        data = await file.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"{file.filename} is over 10 MB.",
            )
        if not data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{file.filename} is empty.",
            )
        name = (file.filename or "file").replace("/", "_").replace("\\", "_")[-200:]
        prepared.append((name, kind, data))

    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        "insert into group_messages (group_id, body) values (:gid, :body) "
                        "returning id, user_id, body, created_at"
                    ),
                    {"gid": group_id, "body": body.strip()},
                )
            )
            .mappings()
            .one()
        )
        attachments = []
        for name, kind, data in prepared:
            saved = (
                (
                    await db.execute(
                        text(
                            "insert into group_attachments "
                            "(message_id, group_id, filename, content_type, size_bytes, data) "
                            "values (:mid, :gid, :name, :kind, :size, :data) "
                            "returning id, filename, content_type, size_bytes"
                        ),
                        {
                            "mid": row["id"],
                            "gid": group_id,
                            "name": name,
                            "kind": kind,
                            "size": len(data),
                            "data": data,
                        },
                    )
                )
                .mappings()
                .one()
            )
            attachments.append(Attachment(**saved))
    author = (
        await db.execute(
            text("select full_name from group_member_list(:gid) where user_id = :uid"),
            {"gid": group_id, "uid": row["user_id"]},
        )
    ).scalar_one_or_none()
    return Message(**row, author=author or "You", attachments=attachments)


@router.get("/{group_id}/files/{file_id}")
async def get_file(group_id: UUID, file_id: UUID, db: UserDb) -> Response:
    """The file's bytes, for members only (row-level security)."""
    row = (
        (
            await db.execute(
                text(
                    "select filename, content_type, data from group_attachments "
                    "where id = :id and group_id = :gid"
                ),
                {"id": file_id, "gid": group_id},
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found.")
    safe_name = row["filename"].encode("ascii", "ignore").decode().replace('"', "") or "file"
    return Response(
        content=bytes(row["data"]),
        media_type=row["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.delete("/{group_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(group_id: UUID, message_id: int, db: UserDb) -> None:
    """Deletes one of your own messages, with its files."""
    deleted = (
        await db.execute(
            text(
                "delete from group_messages where id = :mid and group_id = :gid "
                "and user_id = (select auth.uid()) returning 1"
            ),
            {"mid": message_id, "gid": group_id},
        )
    ).first()
    if deleted is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found.")
