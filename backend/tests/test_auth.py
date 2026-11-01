import time

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.db.session import get_user_db
from app.main import app


class FakeResult:
    def __init__(self, row):
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._row


class FakeSession:
    def __init__(self, row):
        self._row = row

    async def execute(self, *_args, **_kwargs):
        return FakeResult(self._row)


@pytest.fixture
def client_with_profile():
    def _client(row):
        async def _db():
            yield FakeSession(row)

        app.dependency_overrides[get_user_db] = _db
        return TestClient(app)

    yield _client
    app.dependency_overrides.clear()


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_me_returns_profile(client_with_profile, make_token) -> None:
    profile = {
        "id": "6f1c2a4e-5b7d-4c1e-9a3f-2b8d7e6c5a41",
        "email": "student@ucp.edu.pk",
        "full_name": "Muhammad Alishan",
        "notification_channel": "telegram",
        "avatar_url": None,
    }
    response = client_with_profile(profile).get("/api/auth/me", headers=auth(make_token()))
    assert response.status_code == 200
    assert response.json() == profile


def test_me_missing_profile_is_404(client_with_profile, make_token) -> None:
    response = client_with_profile(None).get("/api/auth/me", headers=auth(make_token()))
    assert response.status_code == 404


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"exp": int(time.time()) - 10}, id="expired"),
        pytest.param({"aud": "anon"}, id="wrong-audience"),
        pytest.param({"iss": "https://evil.example.com/auth/v1"}, id="wrong-issuer"),
        pytest.param({"_key": ec.generate_private_key(ec.SECP256R1())}, id="signed-by-another-key"),
    ],
)
def test_me_rejects_bad_tokens(client_with_profile, make_token, overrides) -> None:
    response = client_with_profile({}).get("/api/auth/me", headers=auth(make_token(**overrides)))
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
