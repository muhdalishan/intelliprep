import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.core.config import Settings
from app.db.local_dev import MIGRATIONS_DIR, start_local_database
from app.main import app


def test_local_database_starts_migrates_and_seeds_students(tmp_path) -> None:
    url = start_local_database(tmp_path / "localdb", keep_running=False)
    assert url.startswith("postgresql+asyncpg://")
    plain = url.replace("postgresql+asyncpg://", "postgresql://")
    with psycopg.connect(plain) as conn:
        names = [r[0] for r in conn.execute("select full_name from profiles order by full_name")]
        applied = [
            r[0]
            for r in conn.execute("select name from local_dev.applied_migrations order by name")
        ]
    assert names == ["Ali Khan", "Hamza Raza", "Sara Ahmed"]
    assert applied == sorted(p.name for p in MIGRATIONS_DIR.glob("*.sql"))

    # Starting again reuses everything and changes nothing.
    assert start_local_database(tmp_path / "localdb", keep_running=False) == url


@pytest.fixture
def local_mode(monkeypatch):
    settings = Settings(environment="local", supabase_url="")
    monkeypatch.setattr(security, "get_settings", lambda: settings)
    from app.modules.auth import router as auth_router

    monkeypatch.setattr(auth_router, "get_settings", lambda: settings)


def test_dev_header_picks_the_test_student(local_mode) -> None:
    assert security.get_current_user(None, "sara").id.endswith("0002")
    assert security.get_current_user(None, "unknown").id.endswith("0001")
    session = TestClient(app).get("/api/auth/dev-session", headers={"X-Dev-User": "hamza"}).json()
    assert session["current"] == {"key": "hamza", "name": "Hamza Raza"}
    assert [s["key"] for s in session["students"]] == ["ali", "sara", "hamza"]


def test_dev_header_is_ignored_outside_local(monkeypatch) -> None:
    monkeypatch.setattr(
        security, "get_settings", lambda: Settings(environment="production", supabase_url="")
    )
    with pytest.raises(security.HTTPException):
        security.get_current_user(None, "sara")
    assert TestClient(app).get("/api/auth/dev-session").status_code == 404
