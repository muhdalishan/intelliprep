"""Text extraction from uploaded PDFs (IP-22).

pypdf is used rather than PyMuPDF because PyMuPDF is AGPL-licensed (architecture decision 005).
Pages with no extractable text are reported so scanned pages can go to OCR (IP-23).
"""

import re
from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

MAX_PAGES = 600


class PdfError(Exception):
    """The file can't be used; the message is safe to show the student."""


@dataclass(frozen=True)
class ExtractedPdf:
    pages: list[str]
    """Text per page; index 0 is page 1."""
    empty_pages: list[int]
    """1-based numbers of pages with no text layer (likely scanned)."""


_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")
_SPACES = re.compile(r"[ \t ]+")
_BLANK_LINES = re.compile(r"\n{3,}")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _HYPHEN_BREAK.sub(r"\1\2", text)
    text = _SPACES.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    return _BLANK_LINES.sub("\n\n", text).strip()


def extract_pdf(data: bytes, max_pages: int = MAX_PAGES) -> ExtractedPdf:
    if not data.startswith(b"%PDF-"):
        raise PdfError("This file isn't a PDF.")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise PdfError(
                "This PDF is password-protected. Remove the password and upload it again."
            )
        page_count = len(reader.pages)
    except PdfReadError as exc:
        raise PdfError("This PDF is damaged and couldn't be read.") from exc

    if page_count == 0:
        raise PdfError("This PDF has no pages.")
    if page_count > max_pages:
        raise PdfError(f"This PDF has {page_count} pages; the limit is {max_pages}.")

    pages = [normalize_text(page.extract_text() or "") for page in reader.pages]
    empty = [number for number, text in enumerate(pages, start=1) if not text]
    return ExtractedPdf(pages=pages, empty_pages=empty)
