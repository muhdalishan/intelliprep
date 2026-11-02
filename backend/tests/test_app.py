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
