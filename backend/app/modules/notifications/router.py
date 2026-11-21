"""Reminders and notification settings (IP-110, IP-111).

Students create reminders here (from the Reminders screen, Nova or the planner); the scheduler in
scheduler.py delivers them when due. In-app reminders appear in /inbox for the open app to show.
Telegram is linked with a one-time code: the student opens the bot, the n8n workflow passes the
code back to /telegram/connect, and the server saves their chat id.
"""

import json
from datetime import UTC, datetime, time, timedelta
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text

from app.core import tokens
from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user
from app.db.errors import db_errors
from app.db.session import Sessions, UserDb, service_session
from app.modules.notifications.channels import (
    SIGNATURE_HEADER,
    Channel,
    available_channels,
    verify,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])

LINK_CODE_SECONDS = 15 * 60
PAST_GRACE = timedelta(minutes=5)

Status = Literal["pending", "sent", "failed"]
Source = Literal["manual", "nova", "planner", "flashcards"]


class ReminderIn(BaseModel):
    message: str = Field(min_length=1, max_length=300)
    due_at: datetime
    channel: Channel = "app"
    subject_key: str | None = Field(default=None, max_length=64)
    subject_name: str | None = Field(default=None, max_length=120)
    source: Source = "manual"

    @field_validator("due_at")
    @classmethod
    def _aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("due_at needs a time zone, e.g. 2026-11-05T20:00:00+05:00")
        return value


class ReminderPatch(BaseModel):
    message: str | None = Field(default=None, min_length=1, max_length=300)
    due_at: datetime | None = None
    channel: Channel | None = None


class Reminder(BaseModel):
    id: UUID
    message: str
    due_at: datetime
    channel: Channel
    source: Source
    status: Status
    subject_key: str | None
    subject_name: str | None
    attempts: int
    last_error: str | None
    sent_at: datetime | None
    seen_at: datetime | None


class Preferences(BaseModel):
    channels_available: list[Channel]
    telegram_linked: bool
    email: str
    quiet_hours_start: time | None
    quiet_hours_end: time | None
    timezone: str


class PreferencesPatch(BaseModel):
    quiet_hours_start: time | None = None
    quiet_hours_end: time | None = None
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("timezone")
    @classmethod
    def _known_zone(cls, value: str | None) -> str | None:
        if value is not None:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as exc:
                raise ValueError("Unknown time zone") from exc
        return value


class TelegramLink(BaseModel):
    url: str
    expires_in_seconds: int


class TelegramConnect(BaseModel):
    code: str = Field(max_length=4_000)
    chat_id: int


_COLUMNS = (
    "id, message, due_at, channel, source, status, subject_key, subject_name, attempts, "
    "last_error, sent_at, seen_at"
)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found.")


async def _check_channel(db: UserDb, channel: Channel) -> None:
    if channel not in available_channels():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"{channel.capitalize()} reminders aren't available yet.",
        )
    if channel == "telegram":
        linked = (
            await db.execute(text("select telegram_chat_id is not null from profiles"))
        ).scalar()
        if not linked:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Connect Telegram in Settings first.",
            )


# Reminders ---------------------------------------------------------------------


@router.get("/reminders")
async def list_reminders(
    db: UserDb, subject_key: str | None = None, include_done: bool = False
) -> list[Reminder]:
    where = ["true"]
    if subject_key is not None:
        where.append("subject_key = :key")
    if not include_done:
        where.append("(status = 'pending' or (channel = 'app' and seen_at is null))")
    rows = await db.execute(
        text(f"select {_COLUMNS} from reminders where {' and '.join(where)} order by due_at"),  # noqa: S608
        {"key": subject_key},
    )
    return [Reminder(**row) for row in rows.mappings()]


@router.post("/reminders", status_code=status.HTTP_201_CREATED)
async def create_reminder(body: ReminderIn, db: UserDb) -> Reminder:
    if body.due_at < datetime.now(UTC) - PAST_GRACE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="That time has already passed. Pick a time in the future.",
        )
    await _check_channel(db, body.channel)
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        "insert into reminders (message, due_at, channel, subject_key, "  # noqa: S608
                        "subject_name, source) values (:message, :due_at, :channel, "
                        f":subject_key, :subject_name, :source) returning {_COLUMNS}"
                    ),
                    {**body.model_dump(), "message": body.message.strip()},
                )
            )
            .mappings()
            .one()
        )
    return Reminder(**row)


@router.patch("/reminders/{reminder_id}")
async def update_reminder(reminder_id: UUID, body: ReminderPatch, db: UserDb) -> Reminder:
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Nothing to change."
        )
    if "channel" in changes:
        await _check_channel(db, changes["channel"])
    assignments = ", ".join(f"{column} = :{column}" for column in changes)  # columns from the model
    with db_errors():
        row = (
            (
                await db.execute(
                    text(
                        f"update reminders set {assignments} "  # noqa: S608
                        f"where id = :id and status = 'pending' returning {_COLUMNS}"
                    ),
                    {**changes, "id": reminder_id},
                )
            )
            .mappings()
            .first()
        )
    if row is None:
        raise _not_found()
    return Reminder(**row)


@router.delete("/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(reminder_id: UUID, db: UserDb) -> None:
    deleted = (
        await db.execute(
            text("delete from reminders where id = :id returning 1"), {"id": reminder_id}
        )
    ).first()
    if deleted is None:
        raise _not_found()


# In-app inbox --------------------------------------------------------------------


@router.get("/inbox")
async def inbox(db: UserDb) -> list[Reminder]:
    """Due in-app reminders the app hasn't shown yet."""
    rows = await db.execute(
        text(
            f"select {_COLUMNS} from reminders where channel = 'app' and status <> 'failed' "  # noqa: S608
            "and due_at <= now() and seen_at is null order by due_at"
        )
    )
    return [Reminder(**row) for row in rows.mappings()]


@router.post("/reminders/{reminder_id}/seen", status_code=status.HTTP_204_NO_CONTENT)
async def mark_seen(reminder_id: UUID, db: UserDb) -> None:
    updated = (
        await db.execute(
            text("update reminders set seen_at = now() where id = :id returning 1"),
            {"id": reminder_id},
        )
    ).first()
    if updated is None:
        raise _not_found()


# Preferences and Telegram ------------------------------------------------------


async def _preferences(db: UserDb) -> Preferences:
    row = (
        (
            await db.execute(
                text(
                    "select email, telegram_chat_id is not null as telegram_linked, "
                    "quiet_hours_start, quiet_hours_end, timezone from profiles"
                )
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found.")
    return Preferences(channels_available=available_channels(), **row)


@router.get("/preferences")
async def get_preferences(db: UserDb) -> Preferences:
    return await _preferences(db)


@router.patch("/preferences")
async def update_preferences(body: PreferencesPatch, db: UserDb) -> Preferences:
    changes = body.model_dump(exclude_unset=True)
    if changes:
        assignments = ", ".join(f"{column} = :{column}" for column in changes)  # model columns
        with db_errors():
            await db.execute(
                text(f"update profiles set {assignments} where id = (select auth.uid())"),  # noqa: S608
                changes,
            )
    return await _preferences(db)


@router.post("/telegram/link")
async def telegram_link(user: Annotated[CurrentUser, Depends(get_current_user)]) -> TelegramLink:
    """A link that opens the IntelliPrep bot with a one-time code for this student."""
    bot = get_settings().telegram_bot_username
    if "telegram" not in available_channels():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram reminders aren't set up on this server yet.",
        )
    code = tokens.seal({"uid": user.id, "purpose": "telegram"})
    return TelegramLink(
        url=f"https://t.me/{bot}?start={code}", expires_in_seconds=LINK_CODE_SECONDS
    )


@router.post("/telegram/connect", status_code=status.HTTP_204_NO_CONTENT)
async def telegram_connect(
    request: Request,
    sessions: Sessions,
    signature: Annotated[str | None, Header(alias=SIGNATURE_HEADER)] = None,
) -> None:
    """Called by the n8n workflow when a student taps Start in the bot. Signed, not logged in."""
    raw = await request.body()
    if not verify(raw, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad signature.")
    body = TelegramConnect(**json.loads(raw))
    try:
        payload = tokens.unseal(body.code, LINK_CODE_SECONDS)
    except tokens.InvalidToken as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="This link has expired. Get a new one."
        ) from exc
    if payload.get("purpose") != "telegram":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Wrong code.")
    async with service_session(sessions) as db:
        await db.execute(
            text("update profiles set telegram_chat_id = :chat where id = :uid"),
            {"chat": body.chat_id, "uid": payload["uid"]},
        )
