"""Sealed tokens: data the browser carries between requests but can neither read nor change.

Used where something must stay with the student without a database row, such as the answer to
an adaptive exam question. Tokens are encrypted and authenticated with Fernet (AES-128-CBC with
an HMAC-SHA256 tag), and expire. A signature alone would stop tampering but still let anyone
decode the contents; encryption is what keeps the answer hidden.
"""

import base64
import hashlib
import json
import secrets
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet
from cryptography.fernet import InvalidToken as _FernetInvalid

from app.core.config import get_settings


class InvalidToken(Exception):
    """The token was changed, made with another key, or has expired."""


@lru_cache
def _fernet() -> Fernet:
    configured = get_settings().signing_secret
    key_material = configured.encode() if configured else secrets.token_bytes(32)
    # Fernet needs exactly 32 bytes, base64-encoded; derive them from whatever secret is set.
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(key_material).digest()))


def seal(payload: dict[str, Any]) -> str:
    return _fernet().encrypt(json.dumps(payload).encode()).decode()


def unseal(token: str, max_age_seconds: int) -> dict[str, Any]:
    try:
        return json.loads(_fernet().decrypt(token.encode(), ttl=max_age_seconds))
    except (_FernetInvalid, ValueError) as exc:
        raise InvalidToken from exc
