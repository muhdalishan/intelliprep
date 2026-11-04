"""Study streaks, shared by flashcards and the dashboard."""

from datetime import date, timedelta


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
