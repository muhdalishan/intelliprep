"""Turn an uploaded document's pages into searchable chunks (IP-21, IP-22, IP-30).

This is the ingestion worker's job: chunk, embed, save the chunks, then mark the document
`completed` or `failed`. It runs as a background task after the upload request returns; with
Redis (IP-21) the same function becomes an arq job, so it must not depend on the request.
"""

import logging
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core import llm
from app.core.usage import DatabaseUsageStore, metered
from app.db.session import service_session
from app.modules.documents.chunking import chunk_pages

log = logging.getLogger(__name__)


async def _index_document(
    factory: async_sessionmaker[AsyncSession],
    document_id: UUID,
    user_id: str,
    subject_id: UUID,
    pages: list[str],
) -> None:
    try:
        chunks = chunk_pages(pages)
        vectors = await llm.embed([chunk.text for chunk in chunks])
        async with service_session(factory) as db:
            if chunks:
                await db.execute(
                    text(
                        "insert into document_chunks (document_id, user_id, subject_id, "
                        "chunk_index, content, page_start, page_end, token_estimate, embedding) "
                        "values (:document_id, :user_id, :subject_id, :chunk_index, :content, "
                        ":page_start, :page_end, :token_estimate, "
                        "cast(:embedding as extensions.vector))"
                    ),
                    [
                        {
                            "document_id": document_id,
                            "user_id": user_id,
                            "subject_id": subject_id,
                            "chunk_index": chunk.index,
                            "content": chunk.text,
                            "page_start": chunk.page_start,
                            "page_end": chunk.page_end,
                            "token_estimate": chunk.token_estimate,
                            "embedding": llm.as_vector(vector),
                        }
                        for chunk, vector in zip(chunks, vectors, strict=True)
                    ],
                )
            await db.execute(
                text(
                    "update documents set status = 'completed', chunk_count = :n, "
                    "failure_reason = null where id = :id"
                ),
                {"n": len(chunks), "id": document_id},
            )
    except Exception as exc:
        log.exception("Indexing document %s failed", document_id)
        reason = (
            str(exc)
            if isinstance(exc, llm.AIUnavailable)
            else "Something went wrong while processing this file. Try uploading it again."
        )
        async with service_session(factory) as db:
            await db.execute(
                text("update documents set status = 'failed', failure_reason = :r where id = :id"),
                {"r": reason, "id": document_id},
            )


async def index_document(
    factory: async_sessionmaker[AsyncSession],
    document_id: UUID,
    user_id: str,
    subject_id: UUID,
    pages: list[str],
) -> None:
    """The job, with its embedding tokens counted toward the student's daily AI budget."""
    async with metered(DatabaseUsageStore(factory), user_id):
        await _index_document(factory, document_id, user_id, subject_id, pages)
