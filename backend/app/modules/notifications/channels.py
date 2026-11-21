"""Where a reminder can go, and how it gets there (IP-110).

- app: shown (and spoken by Nova) while IntelliPrep is open; delivery just makes it appear in
  the inbox the app checks.
- telegram, email: handed to the n8n workflow, which sends the message. The request body is
  signed with HMAC-SHA256 so nobody else can make the workflow send messages.
- push, whatsapp, sms: designed for, not available yet.
"""

import hashlib
import hmac
import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal

import httpx

from app.core.config import get_settings

Channel = Literal["app", "telegram", "email", "push", "whatsapp", "sms"]
SIGNATURE_HEADER = "X-IntelliPrep-Signature"


@dataclass(frozen=True)
class Delivery:
    ok: bool
    retry: bool = False
    error: str | None = None


Sender = Callable[[str, bytes, dict[str, str]], Awaitable[httpx.Response]]


def available_channels() -> list[Channel]:
    """Channels this server can deliver to right now."""
    settings = get_settings()
    channels: list[Channel] = ["app"]
    if settings.n8n_webhook_url:
        if settings.telegram_bot_username:
            channels.append("telegram")
        channels.append("email")
    return channels


def sign(body: bytes) -> str:
    return hmac.new(get_settings().n8n_webhook_secret.encode(), body, hashlib.sha256).hexdigest()


def verify(body: bytes, signature: str | None) -> bool:
    secret = get_settings().n8n_webhook_secret
    return bool(secret and signature) and hmac.compare_digest(sign(body), signature or "")


async def post_json(url: str, body: bytes, headers: dict[str, str]) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15) as client:
        return await client.post(url, content=body, headers=headers)


async def deliver(reminder: dict[str, Any], send: Sender = post_json) -> Delivery:
    """Send one due reminder. `reminder` has the reminder row plus the owner's email and chat id."""
    channel: Channel = reminder["channel"]
    if channel == "app":
        return Delivery(ok=True)
    if channel not in available_channels():
        return Delivery(ok=False, error=f"{channel.capitalize()} reminders aren't available yet.")
    if channel == "telegram" and not reminder.get("telegram_chat_id"):
        return Delivery(ok=False, error="Telegram isn't connected. Connect it in Settings.")

    text = reminder["message"]
    if reminder.get("subject_name"):
        text = f"{reminder['subject_name']}: {text}"
    payload = {
        "event": "reminder",
        "reminder_id": str(reminder["id"]),
        "channel": channel,
        "text": f"⏰ {text}",
        "telegram_chat_id": reminder.get("telegram_chat_id"),
        "email": reminder.get("email") if channel == "email" else None,
    }
    body = json.dumps(payload).encode()
    try:
        response = await send(
            get_settings().n8n_webhook_url,
            body,
            {"Content-Type": "application/json", SIGNATURE_HEADER: sign(body)},
        )
    except httpx.HTTPError as exc:
        reason = f"Couldn't reach the message service ({type(exc).__name__})."
        return Delivery(ok=False, retry=True, error=reason)
    if response.is_success:
        return Delivery(ok=True)
    # 4xx means the request itself is wrong (won't get better by retrying); 5xx may be temporary.
    return Delivery(
        ok=False,
        retry=response.status_code >= 500,
        error=f"Message service answered {response.status_code}.",
    )
