"""Adaptive exam simulator: weak-topic question bank and live difficulty adjustment.

Backlog: IP-70, IP-71 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/adaptive-exam", tags=["adaptive-exam"])
