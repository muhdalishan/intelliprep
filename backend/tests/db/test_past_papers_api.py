"""Past papers: upload, question extraction, ranked topics, and who can see them."""

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
from app.modules.exam_guess.processing import _Labels, _Paper, _Question

PAPERS = {
    2023: "1. Explain AVL tree rotations. [10]\n2. Compare hash collision strategies. [5]\n3. Trace merge sort. [5]",
    2024: "1. Show AVL rotations after inserting 5, 3, 1. [10]\n2. Explain hash table resizing. [5]",
    2025: "1. Why do AVL trees rotate? [8]\n2. Find shortest paths with Dijkstra. [12]",
}
TOPIC_DIMS = {"avl": 0, "hash": 1, "sort": 2}


def fake_vector(question: str) -> list[float]:
    """Questions on the same known topic get the same vector; anything else gets its own."""
    vector = [0.0] * llm.EMBEDDING_DIMENSIONS
    dim = next((d for word, d in TOPIC_DIMS.items() if word in question.lower()), None)
    vector[dim if dim is not None else 10 + zlib.crc32(question.encode()) % 1000] = 1.0
    norm = math.sqrt(sum(v * v for v in vector))
    return [v / norm for v in vector]


@pytest.fixture
def ai(monkeypatch):
    state = {"extract_fails": False}

    async def fake_structured(instructions, input, schema, max_output_tokens=6000):
        if schema is _Paper:
            if state["extract_fails"]:
                return _Paper(questions=[])
            lines = re.findall(r"^(\d+)\. (.+?) \[(\d+)\]$", input, flags=re.M)
            return _Paper(questions=[_Question(number=n, text=t, marks=int(m)) for n, t, m in lines])
        if schema is _Labels:
            return _Labels(names=[f"Topic {i}" for i in range(1, input.count("Group ") + 1)])
        raise AssertionError(schema)

    async def fake_embed(texts):
        return [fake_vector(t) for t in texts]

    monkeypatch.setattr(llm, "generate_structured", fake_structured)
    monkeypatch.setattr(llm, "embed", fake_embed)
    return state


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


def upload(client, headers, subject_id, year, body=None, name=None):
    return client.post(
        "/api/exam-guess/papers",
        data={"subject_id": subject_id, "year": str(year), "exam": "final"},
        files={"file": (name or f"final-{year}.txt", (body or PAPERS[year]).encode(), "text/plain")},
        headers=headers,
    )


def predictions(client, headers, subject_id):
    return client.get(f"/api/exam-guess/predictions?subject_id={subject_id}", headers=headers).json()


def test_papers_become_ranked_topics(client, students, ai) -> None:
    alice, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "DSA"}, headers=alice).json()

    first = upload(client, alice, subject["id"], 2023)
    assert first.status_code == 202 and first.json()["status"] == "processing"
    upload(client, alice, subject["id"], 2024)
    early = predictions(client, alice, subject["id"])
    assert (early["papers"], early["ready"], early["papers_needed"], early["topics"]) == (2, False, 1, [])

    upload(client, alice, subject["id"], 2025)
    papers = client.get(f"/api/exam-guess/papers?subject_id={subject['id']}", headers=alice).json()
    assert [(p["year"], p["status"], p["question_count"]) for p in papers] == [
        (2025, "completed", 2), (2024, "completed", 2), (2023, "completed", 3),
    ]

    ranked = predictions(client, alice, subject["id"])
    assert ranked["ready"] is True and ranked["papers_needed"] == 0
    top = ranked["topics"][0]
    assert (top["rank"], top["topic_name"], top["years"]) == (1, "Topic 1", [2023, 2024, 2025])
    assert top["confidence"] == pytest.approx(1.0) and top["frequency"] == pytest.approx(1.0)
    assert [q["year"] for q in top["example_questions"]] == [2025, 2024, 2023]
    assert top["example_questions"][0]["marks"] == 8
    second = ranked["topics"][1]
    assert second["years"] == [2023, 2024] and second["confidence"] < top["confidence"]

    # Removing a paper re-ranks; below 3 papers there are no predictions
    paper_2025 = papers[0]["id"]
    assert client.delete(f"/api/exam-guess/papers/{paper_2025}", headers=alice).status_code == 204
    after = predictions(client, alice, subject["id"])
    assert (after["papers"], after["ready"], after["topics"]) == (2, False, [])


def test_failures_and_outsiders(client, students, ai) -> None:
    alice, bob = students
    subject = client.post("/api/workspace/subjects", json={"name": "OS"}, headers=alice).json()

    ai["extract_fails"] = True
    upload(client, alice, subject["id"], 2022, body="1. Define a process. [5]")
    [paper] = client.get(f"/api/exam-guess/papers?subject_id={subject['id']}", headers=alice).json()
    assert paper["status"] == "failed" and "No questions" in paper["failure_reason"]

    assert upload(client, bob, subject["id"], 2023).status_code == 403
    assert client.get(f"/api/exam-guess/papers?subject_id={subject['id']}", headers=bob).json() == []
    assert predictions(client, bob, subject["id"])["papers"] == 0
    assert client.delete(f"/api/exam-guess/papers/{paper['id']}", headers=bob).status_code == 404

    picture = client.post(
        "/api/exam-guess/papers",
        data={"subject_id": subject["id"], "year": "2024"},
        files={"file": ("scan.png", b"\x89PNG\r\n", "image/png")},
        headers=alice,
    )
    assert picture.status_code == 415
