"""Hybrid search over a subject's chunks (IP-31).

Two searches run inside Postgres and are merged with reciprocal rank fusion:
- vector search (pgvector, cosine distance, HNSW index) finds passages with similar meaning;
- full-text search (tsvector, GIN index) finds exact terms, names and formulas.

A passage scores 1 / (RRF_K + rank) in each list it appears in, so one ranked well in both wins.
The query runs in the student's own session: row-level security decides which chunks they can
see (their own, plus subjects shared with their groups).
"""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import llm

RRF_K = 60
CANDIDATES = 40

_HYBRID = text(
    """
    with vec as (
      select id, row_number() over (
               order by embedding operator(extensions.<=>) cast(:qvec as extensions.vector)) as r
      from document_chunks
      where subject_id = :sid and embedding is not null
      order by embedding operator(extensions.<=>) cast(:qvec as extensions.vector)
      limit :candidates
    ),
    txt as (
      select c.id, row_number() over (order by ts_rank_cd(c.content_tsv, q) desc) as r
      from document_chunks c, websearch_to_tsquery('english', :question) q
      where c.subject_id = :sid and c.content_tsv @@ q
      order by ts_rank_cd(c.content_tsv, q) desc
      limit :candidates
    )
    select c.id, c.document_id, d.filename, c.content, c.page_start, c.page_end,
           coalesce(1.0 / (:rrf_k + vec.r), 0) + coalesce(1.0 / (:rrf_k + txt.r), 0) as score
    from document_chunks c
    join documents d on d.id = c.document_id
    left join vec on vec.id = c.id
    left join txt on txt.id = c.id
    where vec.id is not null or txt.id is not null
    order by score desc
    limit :k
    """
)


@dataclass(frozen=True)
class Passage:
    id: UUID
    document_id: UUID
    filename: str
    content: str
    page_start: int
    page_end: int
    score: float


async def hybrid_search(
    db: AsyncSession, subject_id: UUID, question: str, vector: list[float], k: int
) -> list[Passage]:
    rows = await db.execute(
        _HYBRID,
        {
            "sid": subject_id,
            "question": question,
            "qvec": llm.as_vector(vector),
            "candidates": CANDIDATES,
            "rrf_k": RRF_K,
            "k": k,
        },
    )
    return [Passage(**row) for row in rows.mappings()]
