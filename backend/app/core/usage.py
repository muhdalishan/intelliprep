"""Abuse protection for AI features (IP-130): a per-minute rate limit and a daily token budget.

Every AI endpoint depends on `ai_quota`: it refuses the request (429) when the student has made
too many AI requests in the last minute or used up today's tokens, and afterwards records the
tokens the request used. llm.py adds each call's token count to the meter of the request (or
background job) it runs in, so the budget counts what the AI provider actually bills.

The rate limit is kept in memory per API process (Redis replaces it when there are several,
IP-21); the daily budget is stored in the database (ai_usage) so it holds across processes and
restarts. "Today" is the date in Pakistan, so the budget resets at midnight there.
"""

import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar
from datetime import date
from typing import Annotated, Protocol

from fastapi import Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user
from app.core.streaks import local_today
from app.db.session import get_sessionmaker

WINDOW_SECONDS = 60

_meter: ContextVar[list[int] | None] = ContextVar("ai_usage_meter", default=None)


def record_tokens(tokens: int) -> None:
    """Called by llm.py after every AI call; counts toward whoever is metering right now."""
    meter = _meter.get()
    if meter is not None and tokens > 0:
        meter.append(tokens)


class UsageStore(Protocol):
    async def tokens_on(self, user_id: str, day: date) -> int: ...
    async def add(self, user_id: str, day: date, tokens: int, requests: int) -> None: ...


class DatabaseUsageStore:
    def __init__(self, factory: async_sessionmaker[AsyncSession]):
        self.factory = factory

    async def tokens_on(self, user_id: str, day: date) -> int:
        async with self.factory() as db:
            value = await db.execute(
                text("select tokens from ai_usage where user_id = :uid and day = :day"),
                {"uid": user_id, "day": day},
            )
            return value.scalar() or 0

    async def add(self, user_id: str, day: date, tokens: int, requests: int) -> None:
        async with self.factory() as db, db.begin():
            await db.execute(
                text(
                    "insert into ai_usage (user_id, day, tokens, requests) "
                    "values (:uid, :day, :tokens, :requests) on conflict (user_id, day) do update "
                    "set tokens = ai_usage.tokens + excluded.tokens, "
                    "requests = ai_usage.requests + excluded.requests"
                ),
                {"uid": user_id, "day": day, "tokens": tokens, "requests": requests},
            )


class MemoryUsageStore:
    """For tests and tools: the same contract, kept in memory."""

    def __init__(self) -> None:
        self.usage: dict[tuple[str, date], list[int]] = defaultdict(lambda: [0, 0])

    async def tokens_on(self, user_id: str, day: date) -> int:
        return self.usage[(user_id, day)][0]

    async def add(self, user_id: str, day: date, tokens: int, requests: int) -> None:
        entry = self.usage[(user_id, day)]
        entry[0] += tokens
        entry[1] += requests


def get_usage_store(
    factory: Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)],
) -> UsageStore:
    return DatabaseUsageStore(factory)


class RateLimiter:
    """Sliding one-minute window per student."""

    def __init__(self) -> None:
        self.calls: dict[str, deque[float]] = defaultdict(deque)

    def retry_after(self, user_id: str, limit: int, now: float | None = None) -> int:
        """Seconds until the student may call again, or 0 if allowed (and then counts the call)."""
        now = time.monotonic() if now is None else now
        calls = self.calls[user_id]
        while calls and calls[0] <= now - WINDOW_SECONDS:
            calls.popleft()
        if len(calls) >= limit:
            return max(1, int(calls[0] + WINDOW_SECONDS - now) + 1)
        calls.append(now)
        return 0


limiter = RateLimiter()


async def ai_quota(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    store: Annotated[UsageStore, Depends(get_usage_store)],
) -> AsyncIterator[None]:
    settings = get_settings()
    wait = limiter.retry_after(user.id, settings.ai_requests_per_minute)
    if wait:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many AI requests in a minute. Try again in {wait} seconds.",
            headers={"Retry-After": str(wait)},
        )
    today = local_today(None)
    if await store.tokens_on(user.id, today) >= settings.ai_daily_token_budget:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You've used today's AI allowance. It resets at midnight (Pakistan time).",
        )
    async with metered(store, user.id):
        yield


@asynccontextmanager
async def metered(store: UsageStore, user_id: str) -> AsyncIterator[None]:
    """Counts the AI tokens used inside the block toward the student's daily budget."""
    meter: list[int] = []
    token = _meter.set(meter)
    try:
        yield
    finally:
        _meter.reset(token)
        await store.add(user_id, local_today(None), sum(meter), 1)


AIQuota = Depends(ai_quota)
