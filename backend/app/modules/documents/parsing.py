"""PDF text extraction moved to app.core.pdf (past papers use it too); kept importable here."""

from app.core.pdf import MAX_PAGES as MAX_PAGES
from app.core.pdf import ExtractedPdf as ExtractedPdf
from app.core.pdf import PdfError as PdfError
from app.core.pdf import extract_pdf as extract_pdf
from app.core.pdf import normalize_text as normalize_text
