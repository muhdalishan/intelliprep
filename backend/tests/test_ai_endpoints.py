import pytest
from fastapi.testclient import TestClient

from app.core import llm, security
from app.core.config import Settings
from app.main import app
from app.modules.flashcards.router import Card, _Deck
from app.modules.quizzes.router import Question, _QuestionSet

client = TestClient(app)
NOTES = "AVL trees rotate when a node's balance factor leaves -1..1."


@pytest.fixture
def headers(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def ai(monkeypatch):
    """Stand-in for the AI: records each call and returns whatever the test sets."""
    calls: list[dict] = []
    result: dict = {}

    async def fake_text(instructions, input, max_output_tokens=4000):
        calls.append({"instructions": instructions, "input": input})
        return result["text"]

    async def fake_structured(instructions, input, schema, max_output_tokens=6000):
        calls.append({"instructions": instructions, "input": input, "schema": schema})
        return result["structured"]

    monkeypatch.setattr(llm, "generate_text", fake_text)
    monkeypatch.setattr(llm, "generate_structured", fake_structured)
    return calls, result


def test_summary_wraps_notes_and_returns_text(ai, headers) -> None:
    calls, result = ai
    result["text"] = "# Balanced trees\n- AVL rotations"
    response = client.post(
        "/api/summary/generate", json={"text": NOTES, "focus": "AVL"}, headers=headers
    )
    assert response.status_code == 200
    assert response.json() == {"summary": "# Balanced trees\n- AVL rotations"}
    assert f"<notes>\n{NOTES}\n</notes>" in calls[0]["input"]
    assert "Focus on: AVL" in calls[0]["input"]


@pytest.mark.parametrize("text", ["", "x" * 60_001])
def test_summary_rejects_empty_or_huge_text(ai, headers, text) -> None:
    assert (
        client.post("/api/summary/generate", json={"text": text}, headers=headers).status_code
        == 422
    )


def test_flashcards_drop_blank_cards_and_respect_count(ai, headers) -> None:
    _, result = ai
    result["structured"] = _Deck(
        cards=[Card(front=f"Q{i}", back=f"A{i}") for i in range(5)] + [Card(front=" ", back="x")]
    )
    response = client.post(
        "/api/flashcards/generate", json={"text": NOTES, "count": 3}, headers=headers
    )
    assert response.status_code == 200
    assert [c["front"] for c in response.json()["cards"]] == ["Q0", "Q1", "Q2"]


def test_quiz_keeps_only_well_formed_questions(ai, headers) -> None:
    _, result = ai
    good = Question(
        question="Q?", options=["a", "b", "c", "d"], correct_index=2, explanation="e", topic="t"
    )
    result["structured"] = _QuestionSet(
        questions=[
            good,
            good.model_copy(update={"options": ["a", "b", "c"]}),
            good.model_copy(update={"options": ["a", "a", "c", "d"]}),
            good.model_copy(update={"correct_index": 4}),
        ]
    )
    response = client.post("/api/quiz/generate", json={"text": NOTES}, headers=headers)
    assert response.status_code == 200
    assert len(response.json()["questions"]) == 1


def test_quiz_with_nothing_usable_is_503_with_message(ai, headers) -> None:
    _, result = ai
    result["structured"] = _QuestionSet(questions=[])
    response = client.post("/api/quiz/generate", json={"text": NOTES}, headers=headers)
    assert response.status_code == 503
    assert "No questions" in response.json()["detail"]


def test_tutor_sends_history_as_conversation_and_uses_voice_style(ai, headers) -> None:
    calls, result = ai
    result["text"] = "Good question. Which part feels tricky?"
    body = {
        "message": "Explain rotations",
        "history": [{"role": "user", "text": "hi"}, {"role": "model", "text": "Hello!"}],
        "subject": "Data Structures",
        "notes": NOTES,
        "voice": True,
    }
    response = client.post("/api/tutor/chat", json=body, headers=headers)
    assert response.status_code == 200
    messages = calls[0]["input"]
    assert [m["role"] for m in messages] == ["user", "user", "assistant", "user"]
    assert messages[0]["content"].startswith("<notes>")
    assert "spoken conversation" in calls[0]["instructions"]
    assert "Data Structures" in calls[0]["instructions"]


def test_ai_endpoints_require_sign_in(ai) -> None:
    assert client.post("/api/summary/generate", json={"text": NOTES}).status_code == 401


def test_local_dev_auth_only_without_supabase_in_local(monkeypatch) -> None:
    local = Settings(environment="local", supabase_url="")
    monkeypatch.setattr(security, "get_settings", lambda: local)
    assert security.get_current_user(None) == security.LOCAL_DEV_USER

    for settings in (
        Settings(environment="production", supabase_url=""),
        Settings(environment="local", supabase_url="https://x.supabase.co"),
    ):
        monkeypatch.setattr(security, "get_settings", lambda s=settings: s)
        with pytest.raises(security.HTTPException) as error:
            security.get_current_user(None)
        assert error.value.status_code == 401
