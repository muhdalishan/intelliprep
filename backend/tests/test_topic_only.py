"""A typed topic with no notes is taught from standard knowledge; notes stay inside <notes> tags."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core import llm
from app.main import app

client = TestClient(app)


class FakeResponses:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def create(self, **kwargs):
        self.sent.append(kwargs)
        return SimpleNamespace(output_text="# Summary\n- Hashing", usage=SimpleNamespace(total_tokens=10))


@pytest.fixture
def openai(monkeypatch):
    fake = FakeResponses()
    monkeypatch.setattr(llm, "_client", lambda: SimpleNamespace(responses=fake))
    return fake


@pytest.fixture
def headers(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


def test_topic_without_notes(openai, headers) -> None:
    response = client.post("/api/summary/generate", json={"focus": "Hash tables"}, headers=headers)
    assert response.status_code == 200
    [call] = openai.sent
    assert call["input"] == "Topic: Hash tables"
    assert llm.TOPIC_ONLY_RULE in call["instructions"]


def test_notes_with_topic_keep_the_topic_outside_the_notes(openai, headers) -> None:
    body = {"text": "A hash function maps keys to buckets.", "focus": "Collisions"}
    assert client.post("/api/summary/generate", json=body, headers=headers).status_code == 200
    [call] = openai.sent
    assert call["input"].startswith("Focus on: Collisions\n\n<notes>")
    assert llm.TOPIC_ONLY_RULE not in call["instructions"]


@pytest.mark.parametrize("body", [{}, {"text": "   "}, {"text": "", "focus": "  "}])
def test_needs_notes_or_a_topic(openai, headers, body) -> None:
    response = client.post("/api/summary/generate", json=body, headers=headers)
    assert response.status_code == 422
    assert openai.sent == []
