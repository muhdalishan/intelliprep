"""Summaries from saved documents cite pages and are kept in a private history."""

from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core import llm
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_sessionmaker, get_user_db, user_session
from app.main import app

NOTES = "Paging maps virtual pages to physical frames. A TLB caches recent translations."


@pytest.fixture
def ai(monkeypatch):
    sent: list[dict] = []

    async def fake_embed(texts):
        return [[1.0] + [0.0] * (llm.EMBEDDING_DIMENSIONS - 1) for _ in texts]

    async def fake_text(instructions, input, max_output_tokens=4000):
        sent.append({"instructions": instructions, "input": input})
        return "# Memory\n- Paging maps pages to frames (p. 1)"

    monkeypatch.setattr(llm, "embed", fake_embed)
    monkeypatch.setattr(llm, "generate_text", fake_text)
    return sent


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


def setup_subject(client, headers):
    subject = client.post("/api/workspace/subjects", json={"name": "OS"}, headers=headers).json()
    doc = client.post(
        "/api/documents",
        data={"subject_id": subject["id"]},
        files={"file": ("memory.txt", NOTES.encode(), "text/plain")},
        headers=headers,
    ).json()
    return subject, doc


def test_summary_from_documents_cites_pages_and_is_saved(client, students, ai) -> None:
    alice, _, _ = students
    subject, doc = setup_subject(client, alice)

    made = client.post(
        "/api/summary/documents",
        json={"subject_id": subject["id"], "document_ids": [doc["id"]]},
        headers=alice,
    )
    assert made.status_code == 201
    body = made.json()
    assert body["title"] == "Summary of memory.txt" and body["cites_pages"] is True
    assert body["source_document_ids"] == [doc["id"]]
    assert "--- memory.txt, p. 1 ---" in ai[0]["input"] and "(p. 4)" in ai[0]["instructions"]

    kept = client.post(
        "/api/summary/saved",
        json={"subject_id": subject["id"], "title": "My notes", "content": "# Short\n- TLB"},
        headers=alice,
    )
    assert kept.status_code == 201 and kept.json()["cites_pages"] is False

    history = client.get(f"/api/summary/saved?subject_id={subject['id']}", headers=alice).json()
    assert [s["title"] for s in history] == ["My notes", "Summary of memory.txt"]
    assert client.delete(f"/api/summary/saved/{kept.json()['id']}", headers=alice).status_code == 204
    assert len(client.get("/api/summary/saved", headers=alice).json()) == 1


def test_summaries_respect_who_can_see_what(client, students, ai) -> None:
    alice, bob, carol = students
    subject, doc = setup_subject(client, alice)
    request = {"subject_id": subject["id"], "document_ids": [doc["id"]]}

    assert client.post("/api/summary/documents", json=request, headers=carol).status_code == 404
    assert client.post(
        "/api/summary/saved",
        json={"subject_id": subject["id"], "title": "x", "content": "y"},
        headers=carol,
    ).status_code == 403
    assert ai == []  # the outsider never reached the AI

    group = client.post("/api/groups", json={"name": "OS"}, headers=alice).json()
    client.post("/api/groups/join", json={"invite_code": group["invite_code"]}, headers=bob)
    client.post(f"/api/groups/{group['id']}/subjects", json={"subject_id": subject["id"]}, headers=alice)
    assert client.post("/api/summary/documents", json=request, headers=bob).status_code == 201
    assert client.get("/api/summary/saved", headers=alice).json() == []  # Bob's is his own
