"""Study streaks and the student's local date, shared by flashcards and the dashboard."""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIMEZONE = "Asia/Karachi"


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


def local_today(timezone: str | None) -> date:
    """Today's date where the student is, so "due today" and streaks follow their own midnight."""
    try:
        zone = ZoneInfo(timezone or DEFAULT_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo(DEFAULT_TIMEZONE)
    return datetime.now(zone).date()
