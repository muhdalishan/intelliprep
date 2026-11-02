from dataclasses import dataclass, field
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    claims: dict[str, Any] = field(repr=False)


LOCAL_DEV_USER = CurrentUser(
    id="00000000-0000-0000-0000-000000000001",
    email="dev@localhost",
    claims={"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"},
)


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
) -> CurrentUser:
    """Verify the Supabase access token. Every non-public endpoint depends on this."""
    settings = get_settings()
    if credentials is None:
        if settings.local_dev_auth:
            # Only with ENVIRONMENT=local and no Supabase project configured: lets the app run
            # end to end on one machine before sign-in exists. Never true on staging or production.
            return LOCAL_DEV_USER
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
