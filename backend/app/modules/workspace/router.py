"""Subjects, Kanban tasks and Moodboard notes.

Backlog: IP-14, IP-100, IP-101 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/workspace", tags=["workspace"])
