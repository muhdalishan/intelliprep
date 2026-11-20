"""Files in the group chat: members share and open them, outsiders can't, unsafe types are refused."""

from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_user_db, user_session
from app.main import app

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


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


def test_members_share_and_open_files(client, students) -> None:
    alice, bob, carol = students
    group = client.post("/api/groups", json={"name": "OS crew"}, headers=alice).json()
    client.post("/api/groups/join", json={"invite_code": group["invite_code"]}, headers=bob)
    gid = group["id"]

    sent = client.post(
        f"/api/groups/{gid}/messages/files",
        files=[
            ("files", ("diagram.png", PNG, "image/png")),
            ("files", ("notes.pdf", b"%PDF-1.4 tiny", "application/octet-stream")),
        ],
        data={"body": "Page 3 of the slides"},
        headers=alice,
    )
    assert sent.status_code == 201, sent.text
    message = sent.json()
    assert message["body"] == "Page 3 of the slides"
    assert [(a["filename"], a["content_type"]) for a in message["attachments"]] == [
        ("diagram.png", "image/png"),
        ("notes.pdf", "application/pdf"),  # typed from the extension
    ]

    listed = client.get(f"/api/groups/{gid}/messages", headers=bob).json()
    assert [len(m["attachments"]) for m in listed] == [2]

    image = message["attachments"][0]
    opened = client.get(f"/api/groups/{gid}/files/{image['id']}", headers=bob)
    assert opened.status_code == 200
    assert opened.content == PNG
    assert opened.headers["content-type"] == "image/png"

    # Carol isn't in the group.
    assert client.get(f"/api/groups/{gid}/files/{image['id']}", headers=carol).status_code == 404

    # Only the author can delete; the files go with the message.
    assert client.delete(f"/api/groups/{gid}/messages/{message['id']}", headers=bob).status_code == 404
    assert client.delete(f"/api/groups/{gid}/messages/{message['id']}", headers=alice).status_code == 204
    assert client.get(f"/api/groups/{gid}/files/{image['id']}", headers=alice).status_code == 404


def test_unsafe_or_oversized_files_are_refused(client, students) -> None:
    alice, _, carol = students
    gid = client.post("/api/groups", json={"name": "Nets"}, headers=alice).json()["id"]

    html = client.post(
        f"/api/groups/{gid}/messages/files",
        files=[("files", ("page.html", b"<script>alert(1)</script>", "text/html"))],
        headers=alice,
    )
    assert html.status_code == 415

    big = client.post(
        f"/api/groups/{gid}/messages/files",
        files=[("files", ("huge.png", b"x" * (10 * 1024 * 1024 + 1), "image/png"))],
        headers=alice,
    )
    assert big.status_code == 413

    outsider = client.post(
        f"/api/groups/{gid}/messages/files",
        files=[("files", ("a.png", PNG, "image/png"))],
        headers=carol,
    )
    assert outsider.status_code in (403, 404)
