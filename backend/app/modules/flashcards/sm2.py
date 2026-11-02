"""SM-2 spaced-repetition scheduling (Wozniak, 1987).

Students rate a card Again / Hard / Good / Easy. SM-2 works on a 0-5 quality score, so the
ratings map to 1 / 3 / 4 / 5: anything below 3 is a lapse and the card starts over.
"""

from dataclasses import dataclass, replace
from datetime import date, timedelta
from enum import StrEnum

MIN_EASE_FACTOR = 1.3
INITIAL_EASE_FACTOR = 2.5


class Rating(StrEnum):
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


QUALITY = {Rating.AGAIN: 1, Rating.HARD: 3, Rating.GOOD: 4, Rating.EASY: 5}


@dataclass(frozen=True)
class Schedule:
    ease_factor: float = INITIAL_EASE_FACTOR
    interval_days: int = 1
    repetitions: int = 0
    next_review: date | None = None


def review(schedule: Schedule, rating: Rating, today: date) -> Schedule:
    """Return the schedule after one review on `today`."""
    quality = QUALITY[rating]

    if quality < 3:
        repetitions = 0
        interval = 1
    else:
        if schedule.repetitions == 0:
            interval = 1
        elif schedule.repetitions == 1:
            interval = 6
        else:
            interval = round(schedule.interval_days * schedule.ease_factor)
        repetitions = schedule.repetitions + 1

    ease = schedule.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    ease = max(MIN_EASE_FACTOR, round(ease, 4))

    return replace(
        schedule,
        ease_factor=ease,
        interval_days=interval,
        repetitions=repetitions,
        next_review=today + timedelta(days=interval),
    )


def is_due(schedule: Schedule, today: date) -> bool:
    """A new card (never reviewed) is due immediately."""
    return schedule.next_review is None or schedule.next_review <= today


def study_streak(review_days: set[date], today: date) -> int:
    """Consecutive days with at least one review, ending today.

    Today not reviewed yet doesn't break the streak; it counts back from yesterday.
    A missed full day resets it to zero.
    """
    day = today if today in review_days else today - timedelta(days=1)
    streak = 0
    while day in review_days:
        streak += 1
        day -= timedelta(days=1)
    return streak
