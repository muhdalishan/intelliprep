"""Summary generation grounded in retrieved chunks, with saved history.

Backlog: IP-40 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/summary", tags=["summaries"])
