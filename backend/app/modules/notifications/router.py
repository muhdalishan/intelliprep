"""Reminders and n8n webhooks for Telegram/WhatsApp, with quiet hours.

Backlog: IP-110, IP-111 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/notifications", tags=["notifications"])
