"""The groups and shared workspace API end to end, as three different students."""

from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_user_db, user_session
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
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def students(db, make_token):
    def headers(name):
        uid = db.new_user(name)
        return {"Authorization": f"Bearer {make_token(sub=str(uid))}"}

    return headers("Alice"), headers("Bob"), headers("Carol")


def test_two_students_collaborate_on_a_shared_subject(client, students) -> None:
    alice, bob, carol = students

    subject = client.post(
        "/api/workspace/subjects",
        json={"name": "Data Structures", "exam_date": "2026-11-16"},
        headers=alice,
    ).json()
    group = client.post("/api/groups", json={"name": "DS Midterm Crew"}, headers=alice)
    assert group.status_code == 201
    group = group.json()
    assert group["role"] == "lead" and len(group["invite_code"]) == 8

    joined = client.post(
        "/api/groups/join", json={"invite_code": group["invite_code"].lower()}, headers=bob
    )
    assert joined.status_code == 200
    assert [m["full_name"] for m in joined.json()["members"]] == ["Alice", "Bob"]

    shared = client.post(
        f"/api/groups/{group['id']}/subjects", json={"subject_id": subject["id"]}, headers=alice
    )
    assert shared.status_code == 201
    assert shared.json()["subjects"][0]["shared_by_name"] == "Alice"

    bobs_subjects = client.get("/api/workspace/subjects", headers=bob).json()
    assert [(s["name"], s["owned"], s["shared_in"]) for s in bobs_subjects] == [
        ("Data Structures", False, ["DS Midterm Crew"])
    ]

    task = client.post(
        f"/api/workspace/subjects/{subject['id']}/tasks",
        json={"title": "AVL rotations"},
        headers=bob,
    ).json()
    client.patch(f"/api/workspace/tasks/{task['id']}", json={"status": "learning"}, headers=alice)
    assert (
        client.get(f"/api/workspace/subjects/{subject['id']}/tasks", headers=bob).json()[0][
            "status"
        ]
        == "learning"
    )

    client.post(
        f"/api/workspace/subjects/{subject['id']}/notes",
        json={"content": "Heaps are complete trees"},
        headers=alice,
    )
    assert (
        len(client.get(f"/api/workspace/subjects/{subject['id']}/notes", headers=bob).json()) == 1
    )

    client.post(f"/api/groups/{group['id']}/messages", json={"body": "Library at 5?"}, headers=bob)
    messages = client.get(f"/api/groups/{group['id']}/messages", headers=alice).json()
    assert [(m["author"], m["body"]) for m in messages] == [("Bob", "Library at 5?")]

    # Carol is outside the group
    assert client.get(f"/api/groups/{group['id']}", headers=carol).status_code == 404
    assert client.get("/api/workspace/subjects", headers=carol).json() == []
    assert client.get(f"/api/workspace/subjects/{subject['id']}/tasks", headers=carol).json() == []
    assert (
        client.post(
            f"/api/workspace/subjects/{subject['id']}/tasks", json={"title": "x"}, headers=carol
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/groups/{group['id']}/messages", json={"body": "hi"}, headers=carol
        ).status_code
        == 403
    )


def test_clear_errors_for_wrong_code_and_someone_elses_subject(client, students) -> None:
    alice, bob, _ = students
    wrong = client.post("/api/groups/join", json={"invite_code": "NOPE1234"}, headers=bob)
    assert wrong.status_code == 404
    assert wrong.json()["detail"] == "No group has that invite code"

    subject = client.post(
        "/api/workspace/subjects", json={"name": "Calculus II"}, headers=alice
    ).json()
    group = client.post("/api/groups", json={"name": "Calc"}, headers=bob).json()
    attempt = client.post(
        f"/api/groups/{group['id']}/subjects", json={"subject_id": subject["id"]}, headers=bob
    )
    assert attempt.status_code == 403


def test_member_cannot_unshare_or_remove_others_but_can_leave(client, students) -> None:
    alice, bob, _ = students
    subject = client.post("/api/workspace/subjects", json={"name": "Physics"}, headers=alice).json()
    group = client.post("/api/groups", json={"name": "Phys"}, headers=alice).json()
    client.post("/api/groups/join", json={"invite_code": group["invite_code"]}, headers=bob)
    client.post(
        f"/api/groups/{group['id']}/subjects", json={"subject_id": subject["id"]}, headers=alice
    )

    assert (
        client.delete(
            f"/api/groups/{group['id']}/subjects/{subject['id']}", headers=bob
        ).status_code
        == 403
    )
    alice_id = client.get(f"/api/groups/{group['id']}", headers=bob).json()["members"][0]["user_id"]
    assert (
        client.delete(f"/api/groups/{group['id']}/members/{alice_id}", headers=bob).status_code
        == 403
    )

    assert client.post(f"/api/groups/{group['id']}/leave", headers=bob).status_code == 204
    assert client.get("/api/groups", headers=bob).json() == []
    assert client.get("/api/workspace/subjects", headers=bob).json() == []
