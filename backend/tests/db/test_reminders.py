"""Reminders: created by students, delivered by the scheduler, protected by the database."""

import asyncio
import json
from datetime import UTC, datetime, time, timedelta
from typing import Annotated

import httpx
import psycopg
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_sessionmaker, get_user_db, user_session
from app.main import app
from app.modules.notifications.channels import SIGNATURE_HEADER, sign, verify
from app.modules.notifications.scheduler import dispatch_due, quiet_until

PKT = "Asia/Karachi"


@pytest.fixture
def factory(pg_uri):
    engine = create_async_engine(
        pg_uri.replace("postgresql://", "postgresql+asyncpg://"), poolclass=NullPool
    )
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
def client(factory):
    async def test_db(user: Annotated[CurrentUser, Depends(get_current_user)]):
        async with user_session(factory, user) as session:
            yield session

    app.dependency_overrides[get_user_db] = test_db
    app.dependency_overrides[get_sessionmaker] = lambda: factory
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def n8n(monkeypatch):
    """Turn on Telegram and email delivery through a (fake) n8n workflow."""
    settings = get_settings()
    monkeypatch.setattr(settings, "n8n_webhook_url", "https://n8n.test/webhook/reminders")
    monkeypatch.setattr(settings, "n8n_webhook_secret", "test-secret")
    monkeypatch.setattr(settings, "telegram_bot_username", "IntelliPrepBot")


@pytest.fixture
def student(db, make_token):
    def make(name):
        uid = db.new_user(name)
        return uid, {"Authorization": f"Bearer {make_token(sub=str(uid))}"}

    return make


def soon(minutes: int = 0) -> str:
    return (datetime.now(UTC) + timedelta(minutes=minutes)).isoformat()


def status_of(db, reminder_id):
    return db.conn.execute(
        "select status, attempts, next_attempt_at, last_error from reminders where id = %s",
        (reminder_id,),
    ).fetchone()


class FakeN8n:
    def __init__(self, status_code: int = 200):
        self.status_code = status_code
        self.requests: list[dict] = []

    async def __call__(self, url, body, headers):
        self.requests.append({"url": url, "body": json.loads(body), "headers": headers, "raw": body})
        return httpx.Response(self.status_code)


def test_in_app_reminder_reaches_the_inbox_once(client, student) -> None:
    _, alice = student("Alice")
    later = client.post(
        "/api/notifications/reminders",
        json={"message": "Revise heaps", "due_at": soon(60), "subject_key": "ds", "subject_name": "DS"},
        headers=alice,
    )
    assert later.status_code == 201
    due = client.post(
        "/api/notifications/reminders", json={"message": "Start now", "due_at": soon(-1)}, headers=alice
    ).json()

    inbox = client.get("/api/notifications/inbox", headers=alice).json()
    assert [r["message"] for r in inbox] == ["Start now"]
    assert client.post(f"/api/notifications/reminders/{due['id']}/seen", headers=alice).status_code == 204
    assert client.get("/api/notifications/inbox", headers=alice).json() == []

    listed = client.get("/api/notifications/reminders?subject_key=ds", headers=alice).json()
    assert [r["message"] for r in listed] == ["Revise heaps"]


def test_bad_input_gets_clear_messages(client, student) -> None:
    _, alice = student("Alice")
    past = client.post(
        "/api/notifications/reminders", json={"message": "x", "due_at": soon(-60)}, headers=alice
    )
    assert past.status_code == 422 and "already passed" in past.json()["detail"]
    telegram = client.post(
        "/api/notifications/reminders",
        json={"message": "x", "due_at": soon(5), "channel": "telegram"},
        headers=alice,
    )
    assert telegram.status_code == 422 and "aren't available" in telegram.json()["detail"]


def test_telegram_link_connect_and_delivery(client, student, n8n, factory, db) -> None:
    uid, alice = student("Alice")
    prefs = client.get("/api/notifications/preferences", headers=alice).json()
    assert prefs["channels_available"] == ["app", "telegram", "email"]
    assert prefs["telegram_linked"] is False
    assert client.post(
        "/api/notifications/reminders",
        json={"message": "x", "due_at": soon(5), "channel": "telegram"},
        headers=alice,
    ).status_code == 422  # not linked yet

    link = client.post("/api/notifications/telegram/link", headers=alice).json()
    assert link["url"].startswith("https://t.me/IntelliPrepBot?start=")
    code = link["url"].split("start=")[1]

    body = json.dumps({"code": code, "chat_id": 555123}).encode()
    unsigned = client.post("/api/notifications/telegram/connect", content=body)
    assert unsigned.status_code == 401
    connected = client.post(
        "/api/notifications/telegram/connect", content=body, headers={SIGNATURE_HEADER: sign(body)}
    )
    assert connected.status_code == 204
    assert client.get("/api/notifications/preferences", headers=alice).json()["telegram_linked"]

    reminder = client.post(
        "/api/notifications/reminders",
        json={"message": "Mock test at 8", "due_at": soon(-1), "channel": "telegram", "subject_name": "DS"},
        headers=alice,
    ).json()
    fake = FakeN8n()
    asyncio.run(dispatch_due(factory, send=fake))

    [request] = [r for r in fake.requests if r["body"]["reminder_id"] == reminder["id"]]
    assert request["body"]["telegram_chat_id"] == 555123
    assert request["body"]["text"] == "⏰ DS: Mock test at 8"
    assert verify(request["raw"], request["headers"][SIGNATURE_HEADER])
    assert status_of(db, reminder["id"])["status"] == "sent"
    log = db.conn.execute(
        "select result, attempt from notification_log where reminder_id = %s", (reminder["id"],)
    ).fetchall()
    assert log == [{"result": "sent", "attempt": 1}]


def test_temporary_failures_retry_then_fail(client, student, n8n, factory, db) -> None:
    _, alice = student("Alice")
    reminder = client.post(
        "/api/notifications/reminders",
        json={"message": "Email me", "due_at": soon(-1), "channel": "email"},
        headers=alice,
    ).json()
    down = FakeN8n(status_code=503)
    now = datetime.now(UTC)
    for delay in (0, 1, 5, 15):  # first try, then the three retries
        now += timedelta(minutes=delay, seconds=1)
        asyncio.run(dispatch_due(factory, now=now, send=down))
    row = status_of(db, reminder["id"])
    assert row["status"] == "failed" and row["attempts"] == 4
    assert row["last_error"] == "Message service answered 503."


def test_quiet_hours_hold_messages_until_morning(client, student, n8n, factory, db) -> None:
    _, alice = student("Alice")
    client.patch(
        "/api/notifications/preferences",
        json={"quiet_hours_start": "22:00", "quiet_hours_end": "07:00", "timezone": PKT},
        headers=alice,
    )
    night = datetime(2026, 11, 5, 18, 30, tzinfo=UTC)  # 23:30 in Pakistan
    reminder = client.post(
        "/api/notifications/reminders",
        json={"message": "Late", "due_at": soon(5), "channel": "email"},
        headers=alice,
    ).json()
    db.conn.execute("update reminders set due_at = %s where id = %s", (night, reminder["id"]))

    fake = FakeN8n()
    asyncio.run(dispatch_due(factory, now=night, send=fake))
    row = status_of(db, reminder["id"])
    assert row["status"] == "pending"
    assert row["next_attempt_at"] == datetime(2026, 11, 6, 2, 0, tzinfo=UTC)  # 07:00 in Pakistan


def test_quiet_until() -> None:
    evening = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)  # 17:00 in Pakistan
    assert quiet_until(evening, time(22), time(7), PKT) is None
    assert quiet_until(evening, time(16), time(18), PKT) == datetime(2026, 11, 5, 13, 0, tzinfo=UTC)
    assert quiet_until(evening, None, time(7), PKT) is None


def test_students_cannot_change_delivery_or_see_others(client, student, db) -> None:
    alice_id, alice = student("Alice")
    _, bob = student("Bob")
    reminder = client.post(
        "/api/notifications/reminders", json={"message": "Mine", "due_at": soon(10)}, headers=alice
    ).json()

    assert client.get("/api/notifications/reminders", headers=bob).json() == []
    assert client.delete(f"/api/notifications/reminders/{reminder['id']}", headers=bob).status_code == 404

    with pytest.raises(psycopg.errors.InsufficientPrivilege), db.as_user(alice_id) as conn:
        conn.execute("update reminders set status = 'sent' where id = %s", (reminder["id"],))
    with pytest.raises(psycopg.errors.InsufficientPrivilege), db.as_user(alice_id) as conn:
        conn.execute("update profiles set telegram_chat_id = 1 where id = %s", (alice_id,))
    with db.as_user(alice_id) as conn:  # allowed columns still work
        conn.execute("update profiles set timezone = 'Asia/Dubai' where id = %s", (alice_id,))
