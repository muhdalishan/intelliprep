"""The adaptive exam's rules (IP-70, IP-71). Pure functions, no AI or database.

- The exam starts at Medium.
- Two correct answers in a row move one level harder; two wrong in a row move one level easier.
  The streak starts again after every change of level.
- Questions lean toward the student's weak topics: more misses means more likely, and some
  questions stay open so the rest of the material is covered too.
"""

import random
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

Level = Literal["easy", "medium", "hard", "very_hard"]
LEVELS: tuple[Level, ...] = ("easy", "medium", "hard", "very_hard")
START: Level = "medium"
STREAK = 2
OPEN_SHARE = 0.4  # share of questions not aimed at a weak topic


@dataclass(frozen=True)
class Answered:
    topic: str
    level: Level
    correct: bool


@dataclass(frozen=True)
class WeakTopic:
    topic: str
    misses: int


@dataclass(frozen=True)
class TopicResult:
    topic: str
    correct: int
    total: int


def _step(level: Level, by: int) -> Level:
    index = min(max(LEVELS.index(level) + by, 0), len(LEVELS) - 1)
    return LEVELS[index]


def current_level(history: Sequence[Answered]) -> Level:
    """The level for the next question, given the answers so far."""
    level, right, wrong = START, 0, 0
    for answer in history:
        right, wrong = (right + 1, 0) if answer.correct else (0, wrong + 1)
        if right == STREAK:
            level, right = _step(level, +1), 0
        elif wrong == STREAK:
            level, wrong = _step(level, -1), 0
    return level


def focus_topic(weak: Sequence[WeakTopic], rng: random.Random) -> str | None:
    """A weak topic to aim the next question at, weighted by misses; None means any topic."""
    if not weak or rng.random() < OPEN_SHARE:
        return None
    return rng.choices([w.topic for w in weak], weights=[max(w.misses, 1) for w in weak])[0]


def breakdown(history: Sequence[Answered]) -> list[TopicResult]:
    """Score per topic, weakest first, for the end-of-exam report."""
    totals: dict[str, list[int]] = {}
    for answer in history:
        right, total = totals.setdefault(answer.topic, [0, 0])
        totals[answer.topic] = [right + answer.correct, total + 1]
    results = [TopicResult(topic, right, total) for topic, (right, total) in totals.items()]
    return sorted(results, key=lambda r: (r.correct / r.total, -r.total, r.topic))


def highest_level(history: Sequence[Answered]) -> Level:
    reached = [LEVELS.index(a.level) for a in history] or [LEVELS.index(START)]
    return LEVELS[max(reached)]
