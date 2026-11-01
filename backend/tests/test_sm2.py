from datetime import date

import pytest

from app.modules.flashcards.sm2 import (
    MIN_EASE_FACTOR,
    Rating,
    Schedule,
    is_due,
    review,
    study_streak,
)

TODAY = date(2026, 11, 2)


def test_new_card_starts_at_one_day() -> None:
    card = Schedule()
    assert (card.ease_factor, card.interval_days, card.repetitions) == (2.5, 1, 0)
    assert is_due(card, TODAY)


def test_good_ratings_follow_sm2_intervals() -> None:
    card = Schedule()
    intervals = []
    for _ in range(4):
        card = review(card, Rating.GOOD, TODAY)
        intervals.append(card.interval_days)
    # 1, 6, then interval x EF; EF stays 2.5 on "good" (quality 4)
    assert intervals == [1, 6, 15, 38]
    assert card.ease_factor == 2.5
    assert card.repetitions == 4


def test_again_resets_and_lowers_ease() -> None:
    card = Schedule(ease_factor=2.5, interval_days=15, repetitions=3)
    card = review(card, Rating.AGAIN, TODAY)
    assert card.repetitions == 0
    assert card.interval_days == 1
    assert card.ease_factor == pytest.approx(1.96)
    assert card.next_review == date(2026, 11, 3)


@pytest.mark.parametrize(
    ("rating", "expected_ease"),
    [(Rating.HARD, 2.36), (Rating.GOOD, 2.5), (Rating.EASY, 2.6)],
)
def test_ease_changes_by_rating(rating: Rating, expected_ease: float) -> None:
    assert review(Schedule(), rating, TODAY).ease_factor == pytest.approx(expected_ease)


def test_ease_never_drops_below_floor() -> None:
    card = Schedule()
    for _ in range(10):
        card = review(card, Rating.AGAIN, TODAY)
    assert card.ease_factor == MIN_EASE_FACTOR


def test_due_only_on_or_after_next_review() -> None:
    card = review(review(Schedule(), Rating.GOOD, TODAY), Rating.GOOD, TODAY)
    assert card.next_review == date(2026, 11, 8)
    assert not is_due(card, date(2026, 11, 7))
    assert is_due(card, date(2026, 11, 8))


def days(*day_numbers: int) -> set[date]:
    return {date(2026, 11, d) for d in day_numbers}


@pytest.mark.parametrize(
    ("reviewed", "expected"),
    [
        (days(), 0),
        (days(2), 1),
        (days(1, 2), 2),
        (days(1), 1),  # today not reviewed yet: streak runs through yesterday
        (days(1, 2) | {date(2026, 10, 30)}, 2),  # gap on 31 Oct breaks it
    ],
)
def test_study_streak(reviewed: set[date], expected: int) -> None:
    assert study_streak(reviewed, TODAY) == expected
