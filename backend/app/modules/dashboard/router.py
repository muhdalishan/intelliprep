"""Aggregated dashboard: due cards, predictions, task counts, quiz scores, streak.

Backlog: IP-120 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
