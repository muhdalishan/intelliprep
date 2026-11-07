"""Saved decks, the due-today queue and SM-2 ratings, as owner, group member and outsider."""

from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import CurrentUser, get_current_user
from app.core.streaks import local_today
from app.db.session import get_sessionmaker, get_user_db, user_session
from app.main import app

CARDS = [
    {"front": "AVL rotation", "back": "Rebalances a subtree"},
    {"front": "Heap property", "back": "Parent smaller than children"},
    {"front": "Trie", "back": "Prefix tree"},
]


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
def students(db, make_token):
    def headers(name):
        uid = db.new_user(name)
        return {"Authorization": f"Bearer {make_token(sub=str(uid))}"}

    return headers("Alice"), headers("Bob"), headers("Carol")


def test_deck_due_queue_and_sm2_schedule(client, students) -> None:
    alice, _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "DSA"}, headers=alice).json()

    deck = client.post(
        "/api/flashcards/decks",
        json={"subject_id": subject["id"], "title": "Trees", "cards": CARDS},
        headers=alice,
    )
    assert deck.status_code == 201
    assert {k: deck.json()[k] for k in ("title", "card_count", "due_count", "mastered_count")} == {
        "title": "Trees", "card_count": 3, "due_count": 3, "mastered_count": 0,
    }

    queue = client.get(f"/api/flashcards/due?subject_id={subject['id']}", headers=alice).json()
    assert queue["due_total"] == 3 and queue["streak_days"] == 0 and not queue["reviewed_today"]
    assert queue["today"] == local_today("Asia/Karachi").isoformat()
    first = queue["cards"][0]["id"]

    good = client.post(f"/api/flashcards/{first}/review", json={"rating": "good"}, headers=alice)
    assert good.status_code == 200
    body = good.json()
    assert (body["repetitions"], body["interval_days"], body["streak_days"]) == (1, 1, 1)
    again = client.post(f"/api/flashcards/{first}/review", json={"rating": "good"}, headers=alice).json()
    assert (again["repetitions"], again["interval_days"]) == (2, 6)  # SM-2: 1 day, then 6 days

    queue = client.get(f"/api/flashcards/due?subject_id={subject['id']}", headers=alice).json()
    assert queue["due_total"] == 2 and queue["reviewed_today"] is True
    assert first not in [c["id"] for c in queue["cards"]]

    lapse = client.post(
        f"/api/flashcards/{queue['cards'][0]['id']}/review", json={"rating": "again"}, headers=alice
    ).json()
    assert (lapse["repetitions"], lapse["interval_days"]) == (0, 1)
    assert client.post(f"/api/flashcards/{first}/review", json={"rating": "meh"}, headers=alice).status_code == 422


def test_cards_are_personal_even_in_a_shared_subject(client, students) -> None:
    alice, bob, carol = students
    subject = client.post("/api/workspace/subjects", json={"name": "OS"}, headers=alice).json()
    client.post(
        "/api/flashcards/decks",
        json={"subject_id": subject["id"], "title": "Alice's", "cards": CARDS},
        headers=alice,
    )

    # Before sharing, nobody else can add cards to Alice's subject
    outsider = client.post(
        "/api/flashcards/decks",
        json={"subject_id": subject["id"], "title": "x", "cards": CARDS},
        headers=carol,
    )
    assert outsider.status_code == 403

    group = client.post("/api/groups", json={"name": "OS crew"}, headers=alice).json()
    client.post("/api/groups/join", json={"invite_code": group["invite_code"]}, headers=bob)
    client.post(f"/api/groups/{group['id']}/subjects", json={"subject_id": subject["id"]}, headers=alice)

    mine = client.post(
        "/api/flashcards/decks",
        json={"subject_id": subject["id"], "title": "Bob's", "cards": CARDS[:1]},
        headers=bob,
    )
    assert mine.status_code == 201
    assert [d["title"] for d in client.get("/api/flashcards/decks", headers=bob).json()] == ["Bob's"]
    assert client.get("/api/flashcards/due", headers=bob).json()["due_total"] == 1

    alices_card = client.get("/api/flashcards/due", headers=alice).json()["cards"][0]["id"]
    assert client.post(f"/api/flashcards/{alices_card}/review", json={"rating": "easy"}, headers=bob).status_code == 404


def test_deleting_a_deck_removes_its_cards(client, students) -> None:
    alice, _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "DB"}, headers=alice).json()
    deck = client.post(
        "/api/flashcards/decks",
        json={"subject_id": subject["id"], "title": "Joins", "cards": CARDS},
        headers=alice,
    ).json()
    assert client.delete(f"/api/flashcards/decks/{deck['id']}", headers=alice).status_code == 204
    assert client.get(f"/api/flashcards/due?subject_id={subject['id']}", headers=alice).json()["due_total"] == 0
    assert client.delete(f"/api/flashcards/decks/{deck['id']}", headers=alice).status_code == 404
