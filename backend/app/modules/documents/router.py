"""Document ingestion: uploads, parsing, chunking, processing status.

Two ways in:
- /extract reads a PDF in memory and returns its text, for subjects that still live in the
  browser. Nothing is stored.
- POST /documents saves a document to an account subject and indexes it for search: the record
  is created as the student (so RLS checks they own the subject), then the ingestion job chunks
  and embeds it in the background and sets its status. The original file isn't kept until the
  Storage bucket exists (IP-20); its future path is recorded already.
"""

import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from sqlalchemy import text

from app.core.security import CurrentUser, get_current_user
from app.core.usage import AIQuota
from app.db.errors import db_errors
from app.db.session import Sessions, UserDb, user_session
from app.modules.documents.chunking import chunk_pages
from app.modules.documents.ingestion import index_document
from app.modules.documents.parsing import PdfError, extract_pdf

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
TEXT_SUFFIXES = (".txt", ".md", ".csv")

DocumentStatus = Literal["uploaded", "processing", "completed", "failed"]


class ExtractedDocument(BaseModel):
    filename: str
    page_count: int
    empty_pages: list[int]
    """Pages with no text layer (scanned); they need OCR, which comes with IP-23."""
    chunk_count: int
    text: str
    """All page text, each page introduced by a "--- Page N ---" line so answers can cite pages."""


class StoredDocument(BaseModel):
    id: UUID
    subject_id: UUID
    filename: str
    format: Literal["pdf", "text"]
    status: DocumentStatus
    failure_reason: str | None
    page_count: int | None
    empty_pages: list[int]
    chunk_count: int
    created_at: datetime
    owned: bool


async def _read_upload(file: UploadFile) -> bytes:
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="This file is over 25 MB. Split it or compress it and try again.",
        )
    return data


Format = Literal["pdf", "text"]


async def _pages_of(data: bytes, filename: str) -> tuple[Format, list[str], list[int]]:
    """The file's text, page by page, checked by its content rather than its name."""
    if data.startswith(b"%PDF-"):
        try:
            extracted = await run_in_threadpool(extract_pdf, data)
        except PdfError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
            ) from exc
        return "pdf", extracted.pages, extracted.empty_pages
    if filename.lower().endswith(TEXT_SUFFIXES):
        return "text", [data.decode("utf-8", errors="replace")], []
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Upload a PDF or a text file (.txt, .md).",
    )


@router.post("/extract")
async def extract_document(
    file: UploadFile, _user: Annotated[CurrentUser, Depends(get_current_user)]
) -> ExtractedDocument:
    data = await _read_upload(file)
    try:
        extracted = await run_in_threadpool(extract_pdf, data)
    except PdfError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    chunks = await run_in_threadpool(chunk_pages, extracted.pages)
    text_ = "\n\n".join(
        f"--- Page {number} ---\n{page}"
        for number, page in enumerate(extracted.pages, start=1)
        if page
    )
    return ExtractedDocument(
        filename=file.filename or "document.pdf",
        page_count=len(extracted.pages),
        empty_pages=extracted.empty_pages,
        chunk_count=len(chunks),
        text=text_,
    )


_SELECT = (
    "select id, subject_id, filename, format, status, failure_reason, page_count, empty_pages, "
    "chunk_count, created_at, user_id = (select auth.uid()) as owned from documents "
)


@router.post("", status_code=status.HTTP_202_ACCEPTED, dependencies=[AIQuota])
async def upload_document(
    subject_id: Annotated[UUID, Form()],
    file: UploadFile,
    user: Annotated[CurrentUser, Depends(get_current_user)],
    sessions: Sessions,
    background: BackgroundTasks,
) -> StoredDocument:
    filename = (file.filename or "document").strip()[:200] or "document"
    data = await _read_upload(file)
    kind, pages, empty_pages = await _pages_of(data, filename)
    if not any(page.strip() for page in pages):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "No text could be read from this file. "
                "Scanned pages need OCR, which is coming soon."
            ),
        )

    document_id = uuid4()
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)
    # Committed before the background job starts, so the job always finds the row.
    async with user_session(sessions, user) as db:
        with db_errors():
            row = (
                (
                    await db.execute(
                        text(
                            "insert into documents (id, subject_id, filename, storage_path, "
                            "format, status, page_count, empty_pages) values (:id, :sid, "
                            ":filename, :path, :format, 'processing', :pages, :empty) "
                            "returning id, subject_id, filename, format, status, failure_reason, "
                            "page_count, empty_pages, chunk_count, created_at"
                        ),
                        {
                            "id": document_id,
                            "sid": subject_id,
                            "filename": filename,
                            "path": f"{user.id}/{subject_id}/{document_id}/{safe_name}",
                            "format": kind,
                            "pages": len(pages),
                            "empty": empty_pages,
                        },
                    )
                )
                .mappings()
                .one()
            )
            # Keep the original too, so it can be shared into a group as the file itself.
            await db.execute(
                text(
                    "insert into document_files (document_id, content_type, size_bytes, data) "
                    "values (:id, :type, :size, :data)"
                ),
                {
                    "id": document_id,
                    "type": "application/pdf" if kind == "pdf" else "text/plain",
                    "size": len(data),
                    "data": data,
                },
            )
    background.add_task(index_document, sessions, document_id, user.id, subject_id, pages)
    return StoredDocument(**row, owned=True)


@router.get("")
async def list_documents(subject_id: UUID, db: UserDb) -> list[StoredDocument]:
    rows = await db.execute(
        text(_SELECT + "where subject_id = :sid order by created_at desc"), {"sid": subject_id}
    )
    return [StoredDocument(**row) for row in rows.mappings()]


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: UUID, db: UserDb) -> None:
    """Deletes the document and, through the foreign key, all its chunks and embeddings."""
    deleted = (
        await db.execute(
            text("delete from documents where id = :id returning 1"), {"id": document_id}
        )
    ).first()
    if deleted is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
