"""Study groups: create or join with an invite code, share subjects, chat.

Access rules live in the database (migration 20261103000000_study_groups.sql); these endpoints
run as the calling student, so a request can never see or change more than the policies allow.

Backlog: IP-90, IP-91 (docs/scrum/product-backlog.md)
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
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


class Message(BaseModel):
    id: int
    user_id: UUID
    author: str
    body: str
    created_at: datetime


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
    return [Message(**row) for row in reversed(rows.mappings().all())]


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
