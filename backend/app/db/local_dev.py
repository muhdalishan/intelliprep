"""A real Postgres on this machine for development before the Supabase project exists.

With DATABASE_URL=local (and ENVIRONMENT=local), the backend starts an embedded Postgres
(pgserver, a dev dependency) with its data in backend/.localdb, applies every migration that
hasn't run yet, and creates the test students from app.core.security.DEV_USERS. Supabase's
auth.users, auth.uid() and the authenticated role are stood in for, so the same row-level
security policies apply as in production.
"""

from pathlib import Path

from app.core.security import DEV_USERS

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / ".localdb"
MIGRATIONS_DIR = BACKEND_DIR / "supabase" / "migrations"
DATABASE_NAME = "intelliprep"

SUPABASE_STANDIN = """
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);
create or replace function auth.uid() returns uuid language sql stable as $$
  select (
    coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub'
  )::uuid
$$;
do $$ begin create role authenticated nologin noinherit;
  exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
grant usage on schema public, auth, extensions to authenticated, anon;
grant execute on function auth.uid() to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
create schema if not exists local_dev;
create table if not exists local_dev.applied_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
"""


def apply_schema(uri: str, migrations_dir: Path = MIGRATIONS_DIR) -> list[str]:
    """Apply the stand-in and any migrations not yet applied. Returns the ones applied now."""
    import psycopg

    applied: list[str] = []
    with psycopg.connect(uri, autocommit=True) as conn:
        conn.execute(SUPABASE_STANDIN)
        done = {row[0] for row in conn.execute("select name from local_dev.applied_migrations")}
        for migration in sorted(migrations_dir.glob("*.sql")):
            if migration.name in done:
                continue
            with conn.transaction():
                conn.execute(migration.read_text(encoding="utf-8"))
                conn.execute(
                    "insert into local_dev.applied_migrations (name) values (%s)", (migration.name,)
                )
            applied.append(migration.name)
    return applied


def seed_dev_users(uri: str) -> None:
    import psycopg
    from psycopg.types.json import Jsonb

    with psycopg.connect(uri, autocommit=True) as conn:
        for key, (user_id, name) in DEV_USERS.items():
            conn.execute(
                "insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s) "
                "on conflict (id) do nothing",
                (user_id, f"{key}@dev.localhost", Jsonb({"full_name": name})),
            )


def start_local_database(data_dir: Path = DATA_DIR, keep_running: bool = True) -> str:
    """Start (or reuse) the local Postgres and return an asyncpg URL for SQLAlchemy."""
    try:
        import pgserver
        import psycopg
    except ImportError as exc:  # pragma: no cover - dev dependencies missing
        raise RuntimeError("DATABASE_URL=local needs the dev dependencies: run `uv sync`.") from exc

    data_dir.mkdir(parents=True, exist_ok=True)
    # cleanup_mode=None keeps the server and its data across backend restarts.
    server = pgserver.get_server(data_dir, cleanup_mode=None if keep_running else "stop")
    base = server.get_uri()
    with psycopg.connect(base, autocommit=True) as conn:
        exists = conn.execute(
            "select 1 from pg_database where datname = %s", (DATABASE_NAME,)
        ).fetchone()
        if not exists:
            conn.execute(f"create database {DATABASE_NAME}")
    uri = f"{base.rsplit('/', 1)[0]}/{DATABASE_NAME}"
    apply_schema(uri)
    seed_dev_users(uri)
    return uri.replace("postgresql://", "postgresql+asyncpg://", 1)
