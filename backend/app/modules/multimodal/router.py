"""Diagram and equation understanding via Claude vision, with LaTeX output.

Backlog: IP-80 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/multimodal", tags=["multimodal"])
