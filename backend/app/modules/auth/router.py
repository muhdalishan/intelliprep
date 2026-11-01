"""Authentication and profiles.

Sign-up, login and token refresh happen in the browser with Supabase Auth; this
module only verifies tokens and serves the caller's profile.

Backlog: IP-10, IP-11, IP-12, IP-13 (docs/scrum/product-backlog.md)
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text

from app.core.security import CurrentUser, get_current_user
from app.db.session import UserDb

router = APIRouter(prefix="/auth", tags=["auth"])


class Profile(BaseModel):
    id: UUID
    email: str
    full_name: str
    notification_channel: str
    avatar_url: str | None


@router.get("/me")
async def read_me(
    _user: Annotated[CurrentUser, Depends(get_current_user)],
    db: UserDb,
) -> Profile:
    # RLS limits profiles to the caller's own row, so no WHERE on the id is needed for safety;
    # it is kept to make the intent explicit.
    result = await db.execute(
        text(
            "select id, email, full_name, notification_channel, avatar_url "
            "from public.profiles where id = (select auth.uid())"
        )
    )
    row = result.mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return Profile.model_validate(dict(row))
