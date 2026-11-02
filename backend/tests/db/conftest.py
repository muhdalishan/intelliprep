"""Real Postgres for row-level security tests.

Runs every migration against an embedded Postgres (pgserver) with a small stand-in for the parts
of Supabase the migrations rely on: the auth.users table, auth.uid() and the authenticated role.
"""

import json
from contextlib import contextmanager
from uuid import UUID, uuid4

import pytest

psycopg = pytest.importorskip("psycopg")
pgserver = pytest.importorskip("pgserver")
from psycopg.rows import dict_row  # noqa: E402
from psycopg.types.json import Jsonb  # noqa: E402

from app.db.local_dev import apply_schema  # noqa: E402


@pytest.fixture(scope="session")
def pg_uri(tmp_path_factory) -> str:
    server = pgserver.get_server(tmp_path_factory.mktemp("pg"), cleanup_mode="stop")
    base = server.get_uri()
    name = f"intelliprep_test_{uuid4().hex[:8]}"
    with psycopg.connect(base, autocommit=True) as conn:
        conn.execute(f"create database {name}")
    uri = f"{base.rsplit('/', 1)[0]}/{name}"
    apply_schema(uri)
    return uri


class Db:
    """One connection; `as_user` runs a block as that student, exactly like an API request."""

    def __init__(self, uri: str):
        self.conn = psycopg.connect(uri, autocommit=True, row_factory=dict_row)

    def new_user(self, name: str) -> UUID:
        uid = uuid4()
        self.conn.execute(
            "insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s)",
            (uid, f"{name.lower()}.{uid.hex[:6]}@ucp.edu.pk", Jsonb({"full_name": name})),
        )
        return uid

    @contextmanager
    def as_user(self, uid: UUID):
        with self.conn.transaction():
            self.conn.execute("set local role authenticated")
            self.conn.execute(
                "select set_config('request.jwt.claims', %s, true)",
                (json.dumps({"sub": str(uid), "role": "authenticated"}),),
            )
            yield self.conn


@pytest.fixture
def db(pg_uri):
    database = Db(pg_uri)
    yield database
    database.conn.close()
