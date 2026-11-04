"""The reminder scheduler (IP-110): every minute, deliver what's due.

Each run takes due, pending reminders with FOR UPDATE SKIP LOCKED, so two processes running the
scheduler never send the same reminder twice. A reminder that falls in the student's quiet hours
waits until they end. Temporary failures are retried after 1, 5 and 15 minutes, then the reminder
is marked failed; every attempt is written to notification_log.

It runs as the server (service session) because it works across all students; it only ever
changes delivery fields. With Redis (IP-21) the same `dispatch_due` becomes an arq cron job.
"""

import asyncio
import logging
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.session import service_session
from app.modules.notifications.channels import Sender, deliver, post_json

log = logging.getLogger(__name__)

RETRY_DELAYS = (timedelta(minutes=1), timedelta(minutes=5), timedelta(minutes=15))
BATCH = 100

_DUE = text(
    """
    select r.id, r.user_id, r.message, r.subject_name, r.channel, r.attempts, r.due_at,
           p.email, p.telegram_chat_id, p.quiet_hours_start, p.quiet_hours_end, p.timezone
    from reminders r join profiles p on p.id = r.user_id
    where r.status = 'pending' and r.due_at <= :now
      and (r.next_attempt_at is null or r.next_attempt_at <= :now)
    order by r.due_at
    limit :batch
    for update of r skip locked
    """
)


def quiet_until(
    now: datetime, start: time | None, end: time | None, timezone: str
) -> datetime | None:
    """When the student's quiet hours end, if `now` falls inside them; otherwise None."""
    if start is None or end is None or start == end:
        return None
    try:
        zone = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("Asia/Karachi")
    local = now.astimezone(zone)
    t = local.time().replace(tzinfo=None)
    inside = start <= t < end if start < end else (t >= start or t < end)
    if not inside:
        return None
    end_today = local.replace(hour=end.hour, minute=end.minute, second=0, microsecond=0)
    return (end_today if end_today > local else end_today + timedelta(days=1)).astimezone(UTC)


async def _record(
    db: AsyncSession, reminder: dict, result: str, error: str | None
) -> None:
    await db.execute(
        text(
            "insert into notification_log (reminder_id, user_id, channel, attempt, result, error) "
            "values (:id, :uid, :channel, :attempt, :result, :error)"
        ),
        {
            "id": reminder["id"],
            "uid": reminder["user_id"],
            "channel": reminder["channel"],
            "attempt": reminder["attempts"] + 1,
            "result": result,
            "error": error,
        },
    )


async def dispatch_due(
    factory: async_sessionmaker[AsyncSession], now: datetime | None = None, send: Sender = post_json
) -> dict[str, int]:
    """Deliver every due reminder once. Returns counts by outcome, for logs and tests."""
    now = now or datetime.now(UTC)
    counts = {"sent": 0, "retry": 0, "failed": 0, "deferred": 0}
    async with service_session(factory) as db:
        rows = await db.execute(_DUE, {"now": now, "batch": BATCH})
        due = [dict(row) for row in rows.mappings()]
        for reminder in due:
            start, end = reminder["quiet_hours_start"], reminder["quiet_hours_end"]
            later = quiet_until(now, start, end, reminder["timezone"])
            if later and reminder["channel"] != "app":
                await db.execute(
                    text("update reminders set next_attempt_at = :at where id = :id"),
                    {"at": later, "id": reminder["id"]},
                )
                counts["deferred"] += 1
                continue

            delivery = await deliver(reminder, send)
            attempts = reminder["attempts"] + 1
            if delivery.ok:
                outcome = "sent"
                await db.execute(
                    text(
                        "update reminders set status = 'sent', sent_at = :now, attempts = :n, "
                        "last_error = null where id = :id"
                    ),
                    {"now": now, "n": attempts, "id": reminder["id"]},
                )
            elif delivery.retry and attempts <= len(RETRY_DELAYS):
                outcome = "retry"
                await db.execute(
                    text(
                        "update reminders set attempts = :n, next_attempt_at = :at, "
                        "last_error = :error where id = :id"
                    ),
                    {
                        "n": attempts,
                        "at": now + RETRY_DELAYS[attempts - 1],
                        "error": delivery.error,
                        "id": reminder["id"],
                    },
                )
            else:
                outcome = "failed"
                await db.execute(
                    text(
                        "update reminders set status = 'failed', attempts = :n, "
                        "last_error = :error where id = :id"
                    ),
                    {"n": attempts, "error": delivery.error, "id": reminder["id"]},
                )
            await _record(db, reminder, outcome, delivery.error)
            counts[outcome] += 1
    return counts


async def run_forever(factory: async_sessionmaker[AsyncSession], interval_seconds: int) -> None:
    """The scheduler loop started with the API. One bad run never stops the next."""
    while True:
        try:
            counts = await dispatch_due(factory)
            if any(counts.values()):
                log.info("Reminders: %s", counts)
        except Exception:
            log.exception("Reminder run failed")
        await asyncio.sleep(interval_seconds)
