from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_me_requires_token() -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_rejects_malformed_token() -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_unreachable_database_is_a_clear_503(monkeypatch) -> None:
    from app.db import session

    def no_database():
        raise ConnectionRefusedError("connection refused")

    monkeypatch.setattr(session, "get_sessionmaker", lambda: no_database)
    from app.core import security
    from app.core.config import Settings

    monkeypatch.setattr(
        security, "get_settings", lambda: Settings(environment="local", supabase_url="")
    )
    response = TestClient(app, raise_server_exceptions=False).get("/api/groups")
    assert response.status_code == 503
    assert response.json()["code"] == "database_unavailable"


def test_deploy_refuses_to_start_without_required_settings() -> None:
    from app.core.config import Settings

    assert Settings(_env_file=None, environment="local").missing_for_deploy() == []
    missing = Settings(
        _env_file=None, environment="production", supabase_url="", signing_secret="", openai_api_key=""
    ).missing_for_deploy()
    assert {"SUPABASE_URL", "SIGNING_SECRET", "DATABASE_URL", "OPENAI_API_KEY"} <= set(missing)
    ready = Settings(
        _env_file=None,
        environment="production",
        supabase_url="https://x.supabase.co",
        signing_secret="s" * 40,
        database_url="postgresql+asyncpg://u:p@db.x.supabase.co:5432/postgres",
        openai_api_key="sk-test",
        cors_origins=["https://intelliprep.netlify.app"],
    )
    assert ready.missing_for_deploy() == []
