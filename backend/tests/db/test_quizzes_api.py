"""Saved quizzes: answers hidden by the database, scoring on the server, weak topics."""

from typing import Annotated

import psycopg
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core import llm
from app.core.schemas import MultipleChoice
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_sessionmaker, get_user_db, user_session
from app.main import app
from app.modules.quizzes.router import _QuestionSet

QUESTIONS = [
    MultipleChoice(question="Which structure is LIFO?", options=["Stack", "Queue", "Heap", "Tree"],
                   correct_index=0, explanation="A stack removes the newest item first.", topic="Stacks"),
    MultipleChoice(question="Which is FIFO?", options=["Stack", "Queue", "Trie", "Graph"],
                   correct_index=1, explanation="A queue serves the oldest item first.", topic="Queues"),
    MultipleChoice(question="Heap root holds?", options=["Max or min", "Median", "Random", "Leaf"],
                   correct_index=0, explanation="The root is the extreme value.", topic="Heaps"),
]


@pytest.fixture
def client(pg_uri, monkeypatch):
    async def fake_structured(instructions, input, schema, max_output_tokens=6000):
        return _QuestionSet(questions=QUESTIONS)

    monkeypatch.setattr(llm, "generate_structured", fake_structured)
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
    def make(name):
        uid = db.new_user(name)
        return uid, {"Authorization": f"Bearer {make_token(sub=str(uid))}"}

    return make("Alice"), make("Bob"), make("Carol")


def new_quiz(client, headers, subject_id):
    return client.post(
        "/api/quiz/quizzes",
        json={"subject_id": subject_id, "text": "Stacks, queues and heaps.", "count": 3},
        headers=headers,
    )


def test_quiz_is_scored_on_the_server_and_feeds_weak_topics(client, students) -> None:
    (_, alice), _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "DSA"}, headers=alice).json()

    created = new_quiz(client, alice, subject["id"])
    assert created.status_code == 201
    quiz = created.json()
    assert [set(q) for q in quiz["questions"]] == [{"id", "position", "question", "options", "topic"}] * 3

    ids = [q["id"] for q in quiz["questions"]]
    first = client.post(
        f"/api/quiz/quizzes/{quiz['id']}/attempts",
        json={"answers": [
            {"question_id": ids[0], "chosen_index": 0},  # right
            {"question_id": ids[1], "chosen_index": 0},  # wrong
        ], "time_taken_s": 90},  # third question skipped
        headers=alice,
    )
    assert first.status_code == 201
    result = first.json()
    assert (result["score"], result["total"]) == (1, 3)
    assert [r["correct_index"] for r in result["results"]] == [0, 1, 0]
    assert result["results"][1]["explanation"] == "A queue serves the oldest item first."
    assert result["new_weak_topics"] == ["Queues", "Heaps"]

    retake = client.post(
        f"/api/quiz/quizzes/{quiz['id']}/attempts",
        json={"answers": [
            {"question_id": ids[0], "chosen_index": 0},
            {"question_id": ids[1], "chosen_index": 2},
            {"question_id": ids[2], "chosen_index": 0},
        ]},
        headers=alice,
    ).json()
    assert retake["score"] == 2 and retake["new_weak_topics"] == []  # Queues was already weak

    weak = client.get(f"/api/quiz/weak-topics?subject_id={subject['id']}", headers=alice).json()
    assert [(w["topic"], w["misses"]) for w in weak] == [("Queues", 2), ("Heaps", 1)]

    [summary] = client.get(f"/api/quiz/quizzes?subject_id={subject['id']}", headers=alice).json()
    assert (summary["attempts"], summary["best_score"], summary["last_score"]) == (2, 2, 2)

    bad = client.post(
        f"/api/quiz/quizzes/{quiz['id']}/attempts",
        json={"answers": [{"question_id": subject["id"], "chosen_index": 0}]},
        headers=alice,
    )
    assert bad.status_code == 422


def test_answers_cannot_be_read_or_scores_forged_in_the_database(client, students, db) -> None:
    (alice_id, alice), _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "OS"}, headers=alice).json()
    quiz = new_quiz(client, alice, subject["id"]).json()

    with db.as_user(alice_id) as conn:
        assert conn.execute(
            "select question from quiz_questions where quiz_id = %s", (quiz["id"],)
        ).fetchall()
    with pytest.raises(psycopg.errors.InsufficientPrivilege), db.as_user(alice_id) as conn:
        conn.execute("select correct_index from quiz_questions where quiz_id = %s", (quiz["id"],))
    with pytest.raises(psycopg.errors.InsufficientPrivilege), db.as_user(alice_id) as conn:
        conn.execute(
            "insert into quiz_attempts (quiz_id, user_id, score, total) values (%s, %s, 3, 3)",
            (quiz["id"], alice_id),
        )


def test_quizzes_are_private_and_work_in_shared_subjects(client, students) -> None:
    (_, alice), (_, bob), (_, carol) = students
    subject = client.post("/api/workspace/subjects", json={"name": "DB"}, headers=alice).json()
    quiz = new_quiz(client, alice, subject["id"]).json()

    assert client.get(f"/api/quiz/quizzes/{quiz['id']}", headers=carol).status_code == 404
    assert client.post(
        f"/api/quiz/quizzes/{quiz['id']}/attempts", json={"answers": []}, headers=carol
    ).status_code == 404
    assert new_quiz(client, carol, subject["id"]).status_code == 403

    group = client.post("/api/groups", json={"name": "DB"}, headers=alice).json()
    client.post("/api/groups/join", json={"invite_code": group["invite_code"]}, headers=bob)
    client.post(f"/api/groups/{group['id']}/subjects", json={"subject_id": subject["id"]}, headers=alice)
    assert new_quiz(client, bob, subject["id"]).status_code == 201
    assert len(client.get("/api/quiz/quizzes", headers=alice).json()) == 1  # only her own


def test_flagging_and_clearing_weak_topics(client, students) -> None:
    (_, alice), _, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "Calc"}, headers=alice).json()
    flag = {"subject_id": subject["id"], "topic": "Chain rule", "origin": "flashcard"}
    first = client.post("/api/quiz/weak-topics", json=flag, headers=alice)
    assert first.status_code == 201 and first.json()["misses"] == 1
    assert client.post("/api/quiz/weak-topics", json=flag, headers=alice).json()["misses"] == 2
    assert client.delete(f"/api/quiz/weak-topics/{first.json()['id']}", headers=alice).status_code == 204
    assert client.get("/api/quiz/weak-topics", headers=alice).json() == []
