"""Authentication and profiles.

Sign-up, login and token refresh happen in the browser with Supabase Auth; this
module only verifies tokens and serves the caller's profile.

Backlog: IP-10, IP-11, IP-12, IP-13 (docs/scrum/product-backlog.md)
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import CurrentUser, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(BaseModel):
    id: str
    email: str | None


@router.get("/me")
def read_me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> MeResponse:
    return MeResponse(id=user.id, email=user.email)
