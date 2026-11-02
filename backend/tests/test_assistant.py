import pytest
from fastapi.testclient import TestClient

from app.core import llm
from app.main import app
from app.modules.assistant.router import Action, _Decision

client = TestClient(app)
SUBJECTS = [{"id": "2", "name": "Data Structures"}, {"id": "3", "name": "Calculus II"}]


@pytest.fixture
def headers(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def decide(monkeypatch):
    calls: list[dict] = []

    def _set(decision: _Decision):
        async def fake(instructions, input, schema, max_output_tokens=6000):
            calls.append({"instructions": instructions, "input": input})
            return decision

        monkeypatch.setattr(llm, "generate_structured", fake)
        return calls

    return _set


def action(**fields) -> Action:
    base = dict(subject_id=None, title=None, content=None, due=None, section=None)
    return Action(**(base | fields))


def send(headers, message="hey", **extra):
    body = {"message": message, "now": "2026-11-02T21:15 Mon", "subjects": SUBJECTS, **extra}
    return client.post("/api/assistant/command", json=body, headers=headers)


def test_passes_context_and_name_to_the_model(decide, headers) -> None:
    calls = decide(_Decision(reply="Hi!", actions=[]))
    response = send(headers, "what can you do", assistant_name="Nova", current_subject_id="2")
    assert response.status_code == 200
    assert "You are Nova" in calls[0]["instructions"]
    assert "Current local time: 2026-11-02T21:15 Mon" in calls[0]["input"]
    assert "Current subject: Data Structures (id 2)" in calls[0]["input"]
    assert "id 3: Calculus II" in calls[0]["input"]


def test_keeps_valid_actions_and_normalises_reminder_time(decide, headers) -> None:
    decide(
        _Decision(
            reply="Done.",
            actions=[
                action(type="set_reminder", title="Revise hashing", due="2026-11-03T09:00:00"),
                action(type="add_task", subject_id="2", title="Practise AVL rotations"),
                action(type="add_note", subject_id="3", title="Taylor", content="e^x = sum x^n/n!"),
                action(type="open_section", subject_id="2", section="flashcards"),
            ],
        )
    )
    body = send(headers, "do things").json()
    assert body["skipped"] == []
    assert [a["type"] for a in body["actions"]] == [
        "set_reminder",
        "add_task",
        "add_note",
        "open_section",
    ]
    assert body["actions"][0]["due"] == "2026-11-03T09:00"


@pytest.mark.parametrize(
    ("bad", "message"),
    [
        (action(type="set_reminder", title="x", due="tomorrow-ish"), "no clear time"),
        (action(type="set_reminder", title="x", due="2026-11-01T09:00"), "in the past"),
        (action(type="add_task", subject_id="99", title="x"), "which subject"),
        (action(type="add_note", subject_id="2", title=" "), "had no text"),
    ],
)
def test_drops_actions_it_cannot_carry_out(decide, headers, bad, message) -> None:
    decide(_Decision(reply="Done.", actions=[bad]))
    body = send(headers).json()
    assert body["actions"] == []
    assert message in body["skipped"][0]


def test_rejects_empty_message(headers) -> None:
    assert send(headers, "").status_code == 422
