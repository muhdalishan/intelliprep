import os
import time
from types import SimpleNamespace
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

# Settings are read once and cached, so point them at a fake project before the app is imported.
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

from app.core import security  # noqa: E402

ISSUER = f"{os.environ['SUPABASE_URL']}/auth/v1"


class FakeJwksClient:
    def __init__(self, public_key):
        self._public_key = public_key

    def get_signing_key_from_jwt(self, token: str):
        jwt.get_unverified_header(token)  # malformed tokens fail here, like the real client
        return SimpleNamespace(key=self._public_key)


@pytest.fixture
def signing_key():
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture(autouse=True)
def fake_jwks(monkeypatch, signing_key):
    monkeypatch.setattr(security, "_jwks_client", lambda: FakeJwksClient(signing_key.public_key()))


@pytest.fixture
def make_token(signing_key):
    def _make(**overrides) -> str:
        now = int(time.time())
        claims = {
            "sub": str(uuid4()),
            "email": "student@ucp.edu.pk",
            "aud": "authenticated",
            "iss": ISSUER,
            "iat": now,
            "exp": now + 3600,
            "role": "authenticated",
        }
        claims.update(overrides)
        key = overrides.pop("_key", None) or signing_key
        claims.pop("_key", None)
        return jwt.encode(claims, key, algorithm="ES256")

    return _make


@pytest.fixture(autouse=True)
def no_real_ai_calls(monkeypatch):
    """Tests must never reach a paid AI API, even with a real key in .env."""
    from app.core import llm

    def _refuse():
        raise AssertionError("A test tried to call the real AI provider")

    monkeypatch.setattr(llm, "_client", _refuse)


@pytest.fixture(autouse=True)
def usage_in_memory():
    """AI quota bookkeeping in memory, with a fresh rate limit, unless a test sets its own."""
    from app.core import usage
    from app.main import app

    store = usage.MemoryUsageStore()
    usage.limiter.calls.clear()
    app.dependency_overrides[usage.get_usage_store] = lambda: store
    yield store
    app.dependency_overrides.pop(usage.get_usage_store, None)
