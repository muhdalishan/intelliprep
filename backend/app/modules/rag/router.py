"""Retrieval: embeddings, hybrid search, reranking, grounded answers with citations.

Backlog: IP-30, IP-31, IP-32, IP-33, IP-34, IP-35 (docs/scrum/product-backlog.md)
"""

from fastapi import APIRouter

router = APIRouter(prefix="/rag", tags=["rag"])
