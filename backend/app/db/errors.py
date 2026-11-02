from collections.abc import Iterator
from contextlib import contextmanager

from fastapi import HTTPException, status
from sqlalchemy.exc import DBAPIError

# Postgres error codes the API turns into meaningful responses.
_RESPONSES = {
    "42501": (status.HTTP_403_FORBIDDEN, "You don't have access to that."),  # RLS / privilege
    "P0002": (status.HTTP_404_NOT_FOUND, None),  # raised by our functions, message is safe
    "23505": (status.HTTP_409_CONFLICT, "That's already been done."),  # unique violation
    "23503": (status.HTTP_404_NOT_FOUND, "That item doesn't exist."),  # foreign key
    "23514": (status.HTTP_422_UNPROCESSABLE_CONTENT, "That value isn't allowed."),  # check
    "22P02": (status.HTTP_404_NOT_FOUND, "That item doesn't exist."),  # bad uuid
}


def _sqlstate(error: DBAPIError) -> str | None:
    original = error.orig
    for candidate in (original, getattr(original, "__cause__", None)):
        code = getattr(candidate, "sqlstate", None) or getattr(candidate, "pgcode", None)
        if code:
            return code
    return None


def _message(error: DBAPIError) -> str:
    cause = getattr(error.orig, "__cause__", None) or error.orig
    return str(getattr(cause, "message", None) or cause).split("\n")[0]


@contextmanager
def db_errors() -> Iterator[None]:
    """Turn database refusals into HTTP errors students can understand."""
    try:
        yield
    except DBAPIError as error:
        code = _sqlstate(error)
        if code not in _RESPONSES:
            raise
        status_code, detail = _RESPONSES[code]
        raise HTTPException(status_code=status_code, detail=detail or _message(error)) from error
