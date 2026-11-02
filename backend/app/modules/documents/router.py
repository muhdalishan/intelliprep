"""Document ingestion: presigned uploads, parsing, chunking, processing status.

Until storage exists (IP-20/21), /extract reads an uploaded PDF in memory and returns its text so
the AI features can use real lecture notes. Nothing is stored.

Backlog: IP-20, IP-21, IP-22, IP-23, IP-24, IP-25, IP-26 (docs/scrum/product-backlog.md)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.core.security import CurrentUser, get_current_user
from app.modules.documents.chunking import chunk_pages
from app.modules.documents.parsing import PdfError, extract_pdf

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


class ExtractedDocument(BaseModel):
    filename: str
    page_count: int
    empty_pages: list[int]
    """Pages with no text layer (scanned); they need OCR, which comes with IP-23."""
    chunk_count: int
    text: str
    """All page text, each page introduced by a "--- Page N ---" line so answers can cite pages."""


@router.post("/extract")
async def extract_document(
    file: UploadFile, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> ExtractedDocument:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="This file is over 25 MB. Split it or compress it and try again.",
        )
    try:
        extracted = await run_in_threadpool(extract_pdf, data)
    except PdfError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    chunks = await run_in_threadpool(chunk_pages, extracted.pages)
    text = "\n\n".join(
        f"--- Page {number} ---\n{page}"
        for number, page in enumerate(extracted.pages, start=1)
        if page
    )
    return ExtractedDocument(
        filename=file.filename or "document.pdf",
        page_count=len(extracted.pages),
        empty_pages=extracted.empty_pages,
        chunk_count=len(chunks),
        text=text,
    )
