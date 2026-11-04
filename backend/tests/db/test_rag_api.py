"""Documents are indexed for search and answered from with citations, only for students allowed."""

import math
import re
import zlib
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
from app.modules.rag.router import NOT_IN_NOTES, _Answer

AVL = (
    "AVL trees are self-balancing binary search trees. After an insertion, a node whose balance "
    "factor leaves the range -1 to 1 is fixed with a rotation: a single rotation for the "
    "left-left and right-right cases, a double rotation for left-right and right-left."
)
HEAPS = "A binary heap is a complete tree where every parent is smaller than its children."


def fake_vector(text: str) -> list[float]:
    """Bag of words hashed into 1024 numbers: similar wording gives similar vectors."""
    vector = [0.0] * llm.EMBEDDING_DIMENSIONS
    for word in re.findall(r"[a-z]+", text.lower()):
        vector[zlib.crc32(word.encode()) % len(vector)] += 1.0
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


@pytest.fixture
def ai(monkeypatch):
    """Fake embeddings and a fake answer that cites source 1."""
    asked: list[str] = []

    async def fake_embed(texts):
        return [fake_vector(t) for t in texts]

    async def fake_structured(instructions, input, schema, max_output_tokens=6000):
        asked.append(input)
        return _Answer(answer="A rotation rebalances the tree [1].", in_notes=True, sources_used=[1])

    monkeypatch.setattr(llm, "embed", fake_embed)
    monkeypatch.setattr(llm, "generate_structured", fake_structured)
    return asked


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


def upload(client, headers, subject_id, name, body):
    return client.post(
        "/api/documents",
        data={"subject_id": subject_id},
        files={"file": (name, body.encode(), "text/plain")},
        headers=headers,
    )


def ask(client, headers, subject_id, question):
    return client.post(
        "/api/rag/query", json={"subject_id": subject_id, "question": question}, headers=headers
    )


def test_upload_is_indexed_and_answers_cite_the_page(client, students, ai) -> None:
    alice, _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "DSA"}, headers=alice).json()

    uploaded = upload(client, alice, subject["id"], "avl-notes.txt", AVL)
    assert uploaded.status_code == 202
    assert uploaded.json()["status"] == "processing"

    [document] = client.get(f"/api/documents?subject_id={subject['id']}", headers=alice).json()
    assert document["status"] == "completed" and document["chunk_count"] == 1

    answer = ask(client, alice, subject["id"], "How does an AVL tree fix its balance factor?")
    assert answer.status_code == 200
    body = answer.json()
    assert body["in_notes"] is True
    assert [(c["number"], c["filename"], c["page_start"]) for c in body["citations"]] == [
        (1, "avl-notes.txt", 1)
    ]
    assert "<notes>" in ai[0] and "avl-notes.txt" in ai[0]


def test_question_with_no_matching_notes_skips_the_ai(client, students, ai) -> None:
    alice, _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "Empty"}, headers=alice).json()
    body = ask(client, alice, subject["id"], "What is a red-black tree?").json()
    assert body == {"answer": NOT_IN_NOTES, "in_notes": False, "citations": []}
    assert ai == []


def test_only_owner_and_group_members_can_search(client, students, ai) -> None:
    alice, bob, carol = students
    subject = client.post("/api/workspace/subjects", json={"name": "DS"}, headers=alice).json()
    upload(client, alice, subject["id"], "heaps.txt", HEAPS)

    assert ask(client, alice, subject["id"], "What is a binary heap?").json()["in_notes"]
    assert ask(client, bob, subject["id"], "What is a binary heap?").status_code == 404

    group = client.post("/api/groups", json={"name": "DS crew"}, headers=alice).json()
    client.post("/api/groups/join", json={"invite_code": group["invite_code"]}, headers=bob)
    client.post(
        f"/api/groups/{group['id']}/subjects", json={"subject_id": subject["id"]}, headers=alice
    )
    shared = ask(client, bob, subject["id"], "What is a binary heap?").json()
    assert shared["citations"][0]["filename"] == "heaps.txt"

    assert ask(client, carol, subject["id"], "What is a binary heap?").status_code == 404
    assert client.get(f"/api/documents?subject_id={subject['id']}", headers=carol).json() == []
    # Only the owner can add documents to a subject
    assert upload(client, bob, subject["id"], "bob.txt", HEAPS).status_code == 403


def test_failed_indexing_is_reported_and_delete_removes_chunks(
    client, students, monkeypatch, db
) -> None:
    alice, _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "OS"}, headers=alice).json()

    async def broken_embed(texts):
        raise llm.AIUnavailable("The AI service didn't respond. Try again.")

    monkeypatch.setattr(llm, "embed", broken_embed)
    upload(client, alice, subject["id"], "os.txt", "Paging maps virtual pages to frames.")
    [document] = client.get(f"/api/documents?subject_id={subject['id']}", headers=alice).json()
    assert document["status"] == "failed"
    assert document["failure_reason"] == "The AI service didn't respond. Try again."

    assert client.delete(f"/api/documents/{document['id']}", headers=alice).status_code == 204
    assert client.get(f"/api/documents?subject_id={subject['id']}", headers=alice).json() == []


def test_unsupported_files_are_rejected(client, students, ai) -> None:
    alice, _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "Art"}, headers=alice).json()
    response = client.post(
        "/api/documents",
        data={"subject_id": subject["id"]},
        files={"file": ("photo.png", b"\x89PNG\r\n", "image/png")},
        headers=alice,
    )
    assert response.status_code == 415
