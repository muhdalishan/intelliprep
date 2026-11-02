"""Split extracted pages into overlapping chunks for embedding (IP-22).

Chunks follow the document's own structure: paragraphs stay whole when they fit, long
paragraphs split at sentence ends, and only an over-long sentence splits at words. Every chunk
records the pages it came from so answers can cite them.

Token counts are estimated from words (about 4 tokens per 3 words for English prose); the
embedding model's tokenizer is not needed to stay inside the 300-500 token target.
"""

import math
import re
from dataclasses import dataclass

DEFAULT_MAX_TOKENS = 500
DEFAULT_OVERLAP_TOKENS = 60

_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    page_start: int
    page_end: int
    token_estimate: int


@dataclass(frozen=True)
class _Unit:
    page: int
    text: str
    tokens: int


def estimate_tokens(text: str) -> int:
    words = len(text.split())
    return math.ceil(words * 4 / 3)


def _split_to_fit(text: str, limit: int) -> list[str]:
    if estimate_tokens(text) <= limit:
        return [text]
    pieces: list[str] = []
    for sentence in _SENTENCE_END.split(text):
        if estimate_tokens(sentence) <= limit:
            pieces.append(sentence)
            continue
        words = sentence.split()
        step = max(1, limit * 3 // 4)
        pieces.extend(" ".join(words[i : i + step]) for i in range(0, len(words), step))
    # Re-join neighbouring sentences up to the limit so units aren't needlessly tiny.
    merged: list[str] = []
    for piece in pieces:
        if merged and estimate_tokens(f"{merged[-1]} {piece}") <= limit:
            merged[-1] = f"{merged[-1]} {piece}"
        else:
            merged.append(piece)
    return merged


def _units(pages: list[str], unit_limit: int) -> list[_Unit]:
    units = []
    for page_number, page_text in enumerate(pages, start=1):
        for paragraph in page_text.split("\n\n"):
            paragraph = " ".join(paragraph.split())
            if not paragraph:
                continue
            for piece in _split_to_fit(paragraph, unit_limit):
                units.append(_Unit(page_number, piece, estimate_tokens(piece)))
    return units


def chunk_pages(
    pages: list[str],
    max_tokens: int = DEFAULT_MAX_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
) -> list[Chunk]:
    if overlap_tokens >= max_tokens:
        raise ValueError("overlap_tokens must be smaller than max_tokens")

    chunks: list[Chunk] = []
    current: list[_Unit] = []
    current_tokens = 0

    def emit() -> None:
        chunks.append(
            Chunk(
                index=len(chunks),
                text="\n\n".join(unit.text for unit in current),
                page_start=min(unit.page for unit in current),
                page_end=max(unit.page for unit in current),
                token_estimate=current_tokens,
            )
        )

    for unit in _units(pages, unit_limit=max_tokens - overlap_tokens):
        if current and current_tokens + unit.tokens > max_tokens:
            emit()
            # Carry the trailing units (up to the overlap budget) into the next chunk.
            tail: list[_Unit] = []
            tail_tokens = 0
            for previous in reversed(current):
                if tail_tokens + previous.tokens > overlap_tokens:
                    break
                tail.insert(0, previous)
                tail_tokens += previous.tokens
            current, current_tokens = tail, tail_tokens
        current.append(unit)
        current_tokens += unit.tokens

    if current:
        emit()
    return chunks
