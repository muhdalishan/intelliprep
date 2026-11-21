from dataclasses import dataclass, field
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    claims: dict[str, Any] = field(repr=False)


# Test students for local development without Supabase (see app/db/local_dev.py).
# key -> (user id, full name). The first one is the default.
DEV_USERS: dict[str, tuple[str, str]] = {
    "ali": ("00000000-0000-0000-0000-000000000001", "Ali Khan"),
    "sara": ("00000000-0000-0000-0000-000000000002", "Sara Ahmed"),
    "hamza": ("00000000-0000-0000-0000-000000000003", "Hamza Raza"),
}


def dev_user(key: str | None) -> CurrentUser:
    user_id, _name = DEV_USERS.get((key or "").lower(), DEV_USERS["ali"])
    return CurrentUser(
        id=user_id,
        email=f"{user_id[-1]}@dev.localhost",
        claims={"sub": user_id, "role": "authenticated"},
    )


LOCAL_DEV_USER = dev_user("ali")


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    # Supabase asymmetric signing keys; public keys are cached by PyJWKClient.
    return jwt.PyJWKClient(f"{get_settings().supabase_url}/auth/v1/.well-known/jwks.json")


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    x_dev_user: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Verify the Supabase access token. Every non-public endpoint depends on this."""
    settings = get_settings()
    if credentials is None:
        if settings.local_dev_auth:
            # Only with ENVIRONMENT=local and no Supabase project configured: lets the app run
            # end to end on one machine before sign-in exists. Never true on staging or production.
            # The X-Dev-User header picks a test student, so collaboration can be tried locally.
            return dev_user(x_dev_user)
        raise _unauthorized("Missing bearer token")

    token = credentials.credentials
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=settings.supabase_jwt_audience,
            issuer=f"{settings.supabase_url}/auth/v1",
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid or expired token") from exc

    return CurrentUser(id=claims["sub"], email=claims.get("email"), claims=claims)
