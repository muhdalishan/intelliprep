"""Adaptive exam: difficulty rules, weak-topic focus, hidden answers and the final report."""

import base64
import random
import time

import pytest
from fastapi.testclient import TestClient

from app.core import llm, tokens
from app.core.schemas import MultipleChoice
from app.main import app
from app.modules.adaptive_exam.engine import (
    Answered,
    WeakTopic,
    breakdown,
    current_level,
    focus_topic,
    highest_level,
)
from app.modules.adaptive_exam.router import _Candidates

client = TestClient(app)
NOTES = "A stack is last-in first-out. A queue is first-in first-out."


def answers(*marks: str, topic: str = "Stacks") -> list[Answered]:
    """'y' is a correct answer, 'n' a wrong one; levels are filled in as the exam would."""
    history: list[Answered] = []
    for mark in marks:
        history.append(Answered(topic, current_level(history), mark == "y"))
    return history


@pytest.mark.parametrize(
    ("marks", "level"),
    [
        ("", "medium"),
        ("y", "medium"),
        ("yy", "hard"),
        ("yyyy", "very_hard"),
        ("yyyyyy", "very_hard"),  # can't go above the top
        ("nn", "easy"),
        ("nnnn", "easy"),  # can't go below the bottom
        ("yyn", "hard"),  # one miss doesn't drop a level
        ("yynn", "medium"),
        ("ynyn", "medium"),  # alternating never reaches a streak
    ],
)
def test_two_in_a_row_moves_the_level(marks, level) -> None:
    assert current_level(answers(*marks)) == level


def test_focus_leans_on_weak_topics_but_leaves_room() -> None:
    weak = [WeakTopic("Recursion", misses=8), WeakTopic("Queues", misses=1)]
    rng = random.Random(7)  # noqa: S311
    picks = [focus_topic(weak, rng) for _ in range(2000)]
    assert picks.count("Recursion") > 4 * picks.count("Queues")
    assert 0.3 < picks.count(None) / len(picks) < 0.5
    assert focus_topic([], rng) is None


def test_breakdown_lists_weakest_topic_first() -> None:
    history = [
        Answered("Stacks", "medium", True),
        Answered("Queues", "medium", False),
        Answered("Stacks", "hard", True),
        Answered("Queues", "easy", True),
    ]
    assert [(r.topic, r.correct, r.total) for r in breakdown(history)] == [
        ("Queues", 1, 2),
        ("Stacks", 2, 2),
    ]
    assert highest_level(history) == "hard"


@pytest.fixture
def headers(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def ai(monkeypatch):
    calls: list[str] = []
    questions = [
        MultipleChoice(
            question="Which structure is LIFO?",
            options=["Stack", "Queue", "Heap", "Tree"],
            correct_index=0,
            explanation="A stack removes the newest item first.",
            topic="Stacks",
        )
    ]

    async def fake_structured(instructions, input, schema, max_output_tokens=6000):
        calls.append(input)
        return _Candidates(questions=questions)

    monkeypatch.setattr(llm, "generate_structured", fake_structured)
    return calls, questions


def test_next_question_hides_the_answer_until_checked(ai, headers) -> None:
    calls, _ = ai
    history = [{"topic": "Stacks", "level": "medium", "correct": True}] * 2
    response = client.post(
        "/api/adaptive-exam/next", json={"text": NOTES, "history": history}, headers=headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["level"] == "hard"
    assert "Hard:" in calls[0] and "<notes>" in calls[0]
    assert set(body["question"]) == {"question", "options", "topic"}  # no correct_index

    wrong = client.post(
        "/api/adaptive-exam/answer", json={"token": body["token"], "chosen_index": 2}, headers=headers
    ).json()
    assert wrong["correct"] is False and wrong["correct_index"] == 0 and wrong["level"] == "hard"
    right = client.post(
        "/api/adaptive-exam/answer", json={"token": body["token"], "chosen_index": 0}, headers=headers
    ).json()
    assert right["correct"] is True


def test_the_answer_cannot_be_read_from_the_token(ai, headers) -> None:
    token = client.post("/api/adaptive-exam/next", json={"text": NOTES}, headers=headers).json()[
        "token"
    ]
    decoded = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
    assert b"stack removes the newest" not in decoded and b'"c"' not in decoded


def test_tampered_or_expired_tokens_are_refused(ai, headers, monkeypatch) -> None:
    token = client.post("/api/adaptive-exam/next", json={"text": NOTES}, headers=headers).json()[
        "token"
    ]
    tampered = token[:-6] + ("A" if token[-6] != "A" else "B") + token[-5:]
    real_time = time.time
    expired = tokens.seal({"c": 0, "e": "", "t": "x", "l": "easy"})
    monkeypatch.setattr(time, "time", lambda: real_time() + 3 * 60 * 60)
    for bad in (tampered, "nonsense", expired):
        response = client.post(
            "/api/adaptive-exam/answer", json={"token": bad, "chosen_index": 0}, headers=headers
        )
        assert response.status_code == 400


def test_repeated_questions_are_not_served_again(ai, headers) -> None:
    response = client.post(
        "/api/adaptive-exam/next",
        json={"text": NOTES, "previous_questions": ["which structure is   LIFO?"]},
        headers=headers,
    )
    assert response.status_code == 503


def test_summary_reports_score_levels_and_topics(headers) -> None:
    history = [
        {"topic": "Stacks", "level": "medium", "correct": True},
        {"topic": "Stacks", "level": "medium", "correct": True},
        {"topic": "Queues", "level": "hard", "correct": False},
    ]
    body = client.post("/api/adaptive-exam/summary", json={"history": history}, headers=headers).json()
    assert body["score"] == 2 and body["total"] == 3
    assert body["final_level"] == "hard" and body["highest_level"] == "hard"
    assert body["topics"][0] == {"topic": "Queues", "correct": 0, "total": 1}
