"""Deleting a subject removes what was saved under it, and only its owner can delete it."""

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
def students(db, make_token):
    def headers(name):
        uid = db.new_user(name)
        return {"Authorization": f"Bearer {make_token(sub=str(uid))}"}

    return headers("Alice"), headers("Bob")


def test_owner_deletes_subject_and_its_decks(client, students) -> None:
    alice, bob = students
    subject = client.post("/api/workspace/subjects", json={"name": "Networks"}, headers=alice)
    sid = subject.json()["id"]
    deck = client.post(
        "/api/flashcards/decks",
        json={"subject_id": sid, "title": "TCP", "cards": [{"front": "SYN?", "back": "Start"}]},
        headers=alice,
    )
    assert deck.status_code == 201

    assert client.delete(f"/api/workspace/subjects/{sid}", headers=bob).status_code == 404
    assert client.delete(f"/api/workspace/subjects/{sid}", headers=alice).status_code == 204

    assert client.get("/api/workspace/subjects", headers=alice).json() == []
    assert client.get(f"/api/flashcards/decks?subject_id={sid}", headers=alice).json() == []
    assert client.delete(f"/api/workspace/subjects/{sid}", headers=alice).status_code == 404
