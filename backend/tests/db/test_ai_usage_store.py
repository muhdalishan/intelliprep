"""The daily AI budget is kept in the database, written only by the server."""

import asyncio
from datetime import date

import psycopg
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.usage import DatabaseUsageStore


def test_usage_adds_up_per_day_and_students_cannot_write_it(pg_uri, db) -> None:
    uid = db.new_user("Alice")
    engine = create_async_engine(
        pg_uri.replace("postgresql://", "postgresql+asyncpg://"), poolclass=NullPool
    )
    store = DatabaseUsageStore(async_sessionmaker(engine, expire_on_commit=False))
    day = date(2026, 11, 8)

    async def run():
        await store.add(str(uid), day, 1200, 1)
        await store.add(str(uid), day, 800, 1)
        await store.add(str(uid), date(2026, 11, 9), 50, 1)
        return await store.tokens_on(str(uid), day), await store.tokens_on(str(uid), date(2026, 1, 1))

    assert asyncio.run(run()) == (2000, 0)
    with db.as_user(uid) as conn:
        assert conn.execute("select tokens, requests from ai_usage where day = %s", (day,)).fetchone() == {
            "tokens": 2000, "requests": 2,
        }
    with pytest.raises(psycopg.errors.InsufficientPrivilege), db.as_user(uid) as conn:
        conn.execute("update ai_usage set tokens = 0 where user_id = %s", (uid,))
