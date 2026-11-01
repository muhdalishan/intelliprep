"""Study groups: invites, membership, shared notes and group queries with attribution.

Backlog: IP-90, IP-91 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/groups", tags=["groups"])
