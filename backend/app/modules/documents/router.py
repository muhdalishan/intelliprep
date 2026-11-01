"""Document ingestion: presigned uploads, parsing, chunking, processing status.

Backlog: IP-20, IP-21, IP-22, IP-23, IP-24, IP-25, IP-26 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/documents", tags=["documents"])
