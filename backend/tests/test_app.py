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
