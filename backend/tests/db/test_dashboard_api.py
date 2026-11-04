"""The dashboard adds up only what each student is allowed to see."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_sessionmaker, get_user_db, user_session
from app.main import app


@pytest.fixture
def client(pg_uri):
    engine = create_async_engine(
        pg_uri.replace("postgresql://", "postgresql+asyncpg://"), poolclass=NullPool
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def test_db(user: Annotated[CurrentUser, Depends(get_current_user)]):
        async with user_session(factory, user) as session:
            yield session

    app.dependency_overrides[get_user_db] = test_db
    app.dependency_overrides[get_sessionmaker] = lambda: factory
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def student(db, make_token):
    def make(name):
        uid = db.new_user(name)
        return uid, {"Authorization": f"Bearer {make_token(sub=str(uid))}"}

    return make


def test_dashboard_numbers_and_who_sees_them(client, student, db) -> None:
    alice_id, alice = student("Alice")
    _, bob = student("Bob")
    today = datetime.now(UTC).date()

    soon = client.post(
        "/api/workspace/subjects",
        json={"name": "Data Structures", "exam_date": (today + timedelta(days=10)).isoformat()},
        headers=alice,
    ).json()
    client.post(
        "/api/workspace/subjects",
        json={"name": "Old course", "exam_date": (today - timedelta(days=3)).isoformat()},
        headers=alice,
    )
    for title, state in [("Heaps", "todo"), ("Tries", "todo"), ("Stacks", "mastered")]:
        client.post(
            f"/api/workspace/subjects/{soon['id']}/tasks",
            json={"title": title, "status": state},
            headers=alice,
        )

    with db.as_user(alice_id) as conn:
        due = conn.execute(
            "insert into flashcards (subject_id, term, definition) values (%s, 'Heap', 'Tree') "
            "returning id",
            (soon["id"],),
        ).fetchone()["id"]
        conn.execute(
            "insert into flashcards (subject_id, term, definition, next_review) "
            "values (%s, 'Trie', 'Prefix tree', %s)",
            (soon["id"], today + timedelta(days=4)),
        )
        for day in (today, today - timedelta(days=1)):
            conn.execute(
                "insert into flashcard_reviews (flashcard_id, rating, reviewed_on) "
                "values (%s, 'good', %s)",
                (due, day),
            )
    db.conn.execute(
        "insert into exam_predictions (user_id, subject_id, rank, topic_name, confidence, "
        "frequency, years, question_ids) values (%s, %s, 1, 'Heaps', 0.9, 0.8, '{2024}', '{}')",
        (alice_id, soon["id"]),
    )
    db.conn.execute(
        "insert into documents (user_id, subject_id, filename, storage_path, format, status) "
        "values (%s, %s, 'week3.pdf', %s, 'pdf', 'completed')",
        (alice_id, soon["id"], f"{alice_id}/{soon['id']}/x/week3.pdf"),
    )
    client.post(
        "/api/notifications/reminders",
        json={
            "message": "Mock test",
            "due_at": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
            "subject_name": "Data Structures",
        },
        headers=alice,
    )

    mine = client.get("/api/dashboard", headers=alice)
    assert mine.status_code == 200
    body = mine.json()
    assert body["subjects"] == 2
    assert body["next_exam"]["subject_name"] == "Data Structures"
    assert body["next_exam"]["days_left"] == 10
    assert body["cards_due_today"] == 1
    assert body["streak_days"] == 2 and body["reviewed_today"] is True
    assert body["tasks"] == {"todo": 2, "learning": 0, "practiced": 0, "mastered": 1}
    assert body["top_predictions"] == [
        {"subject_name": "Data Structures", "topic_name": "Heaps", "confidence": pytest.approx(0.9)}
    ]
    assert [d["filename"] for d in body["recent_documents"]] == ["week3.pdf"]
    assert [r["message"] for r in body["upcoming_reminders"]] == ["Mock test"]

    # Bob sees nothing of Alice's...
    empty = client.get("/api/dashboard", headers=bob).json()
    assert empty["subjects"] == 0 and empty["next_exam"] is None
    assert empty["tasks"] == {"todo": 0, "learning": 0, "practiced": 0, "mastered": 0}

    # ...until she shares the subject: then its exam, planner and documents, but never her
    # own flashcards, streak or reminders.
    group = client.post("/api/groups", json={"name": "DS"}, headers=alice).json()
    client.post("/api/groups/join", json={"invite_code": group["invite_code"]}, headers=bob)
    client.post(f"/api/groups/{group['id']}/subjects", json={"subject_id": soon["id"]}, headers=alice)
    shared = client.get("/api/dashboard", headers=bob).json()
    assert shared["next_exam"]["subject_name"] == "Data Structures"
    assert shared["tasks"]["todo"] == 2
    assert [d["filename"] for d in shared["recent_documents"]] == ["week3.pdf"]
    assert shared["cards_due_today"] == 0 and shared["streak_days"] == 0
    assert shared["upcoming_reminders"] == [] and shared["top_predictions"] == []
