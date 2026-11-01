import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import CurrentUser, get_current_user

engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_user_db(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AsyncIterator[AsyncSession]:
    """Database session that runs as the calling user, so Postgres row-level security applies.

    Uses the same contract as Supabase RLS policies (`auth.uid()` reads
    `request.jwt.claims`). Request handlers must use this, never a superuser session.
    """
    async with SessionLocal() as session, session.begin():
        await session.execute(text("SET LOCAL ROLE authenticated"))
        await session.execute(
            text("SELECT set_config('request.jwt.claims', :claims, true)"),
            {"claims": json.dumps(user.claims)},
        )
        yield session


UserDb = Annotated[AsyncSession, Depends(get_user_db)]
