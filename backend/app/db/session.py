import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """Created on first use, so importing the app never connects anywhere."""
    url = get_settings().database_url
    if url == "local":
        from app.db.local_dev import start_local_database

        url = start_local_database()
    engine = create_async_engine(url, pool_pre_ping=True)
    return async_sessionmaker(engine, expire_on_commit=False)


@asynccontextmanager
async def user_session(
    factory: async_sessionmaker[AsyncSession], user: CurrentUser
) -> AsyncIterator[AsyncSession]:
    """One transaction run as `user`: the `authenticated` role with their JWT claims."""
    async with factory() as session, session.begin():
        await session.execute(text("SET LOCAL ROLE authenticated"))
        await session.execute(
            text("SELECT set_config('request.jwt.claims', :claims, true)"),
            {"claims": json.dumps(user.claims)},
        )
        yield session


async def get_user_db(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AsyncIterator[AsyncSession]:
    """Database session that runs as the calling user, so Postgres row-level security applies.

    Uses the same contract as Supabase RLS policies (`auth.uid()` reads
    `request.jwt.claims`). Request handlers must use this, never a superuser session.
    """
    async with user_session(get_sessionmaker(), user) as session:
        yield session


UserDb = Annotated[AsyncSession, Depends(get_user_db)]

Sessions = Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)]
"""The session factory, for handlers that open their own transactions (e.g. before a job)."""


@asynccontextmanager
async def service_session(
    factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncSession]:
    """One transaction as the server itself, so row-level security does not apply.

    Only for writes the system makes on a student's behalf, like the ingestion worker saving
    chunks, and only after a user session has checked the student may act on that row. Never use
    it to read data for a response. On Supabase this is the `postgres` connection, which bypasses
    RLS; locally it is the database superuser.
    """
    async with factory() as session, session.begin():
        yield session
