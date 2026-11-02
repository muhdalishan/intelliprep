import pytest

from app.modules.documents.chunking import chunk_pages, estimate_tokens
from app.modules.documents.parsing import PdfError, extract_pdf, normalize_text


def make_pdf(pages: list[list[str]]) -> bytes:
    """Build a small text PDF: one list of lines per page (an empty list makes a blank page)."""
    objects: list[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    catalog = add(b"")  # filled in below
    pages_obj = add(b"")
    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    kids = []
    for lines in pages:
        escaped = [
            line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines
        ]
        ops = " T* ".join(f"({line}) Tj" for line in escaped)
        stream = f"BT /F1 11 Tf 14 TL 72 750 Td {ops} ET".encode() if lines else b""
        content = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        kids.append(
            add(
                b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 612 792] "
                b"/Resources << /Font << /F1 %d 0 R >> >> /Contents %d 0 R >>"
                % (pages_obj, font, content)
            )
        )
    objects[catalog - 1] = b"<< /Type /Catalog /Pages %d 0 R >>" % pages_obj
    kid_refs = b" ".join(b"%d 0 R" % k for k in kids)
    objects[pages_obj - 1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kid_refs, len(kids))

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        catalog,
        xref,
    )
    return bytes(out)


# Parsing ------------------------------------------------------------------


def test_extracts_text_per_page_and_flags_blank_pages() -> None:
    pdf = make_pdf(
        [["Lecture 6: Balanced Trees", "AVL trees rotate when unbalanced."], [], ["Hashing"]]
    )
    result = extract_pdf(pdf)
    assert len(result.pages) == 3
    assert "AVL trees rotate" in result.pages[0]
    assert result.pages[2] == "Hashing"
    assert result.empty_pages == [2]


def test_rejects_files_that_are_not_pdfs() -> None:
    with pytest.raises(PdfError, match="isn't a PDF"):
        extract_pdf(b"PK\x03\x04 this is a zip")


def test_rejects_damaged_pdf() -> None:
    with pytest.raises(PdfError):
        extract_pdf(b"%PDF-1.4\nnot really a pdf")


def test_rejects_pdfs_over_the_page_limit() -> None:
    with pytest.raises(PdfError, match="limit is 2"):
        extract_pdf(make_pdf([["a"], ["b"], ["c"]]), max_pages=2)


def test_normalize_joins_hyphenated_line_breaks_and_spaces() -> None:
    assert normalize_text("bal-\nanced   tree\r\n\n\n\nnext") == "balanced tree\n\nnext"


# Chunking -----------------------------------------------------------------


def paragraph(n: int, words: int = 60) -> str:
    return " ".join(f"p{n}w{i}" for i in range(words)) + "."


def test_short_document_is_one_chunk() -> None:
    chunks = chunk_pages(["Intro paragraph.\n\nSecond paragraph."])
    assert len(chunks) == 1
    assert chunks[0].text == "Intro paragraph.\n\nSecond paragraph."
    assert (chunks[0].page_start, chunks[0].page_end) == (1, 1)


def test_long_document_chunks_stay_under_limit_and_overlap() -> None:
    pages = ["\n\n".join(paragraph(page * 10 + i) for i in range(6)) for page in range(5)]
    chunks = chunk_pages(pages, max_tokens=500, overlap_tokens=90)

    assert len(chunks) > 1
    assert all(chunk.token_estimate <= 500 for chunk in chunks)
    assert all(estimate_tokens(chunk.text) <= 500 for chunk in chunks)
    # Each chunk begins with the last paragraph of the one before it.
    for previous, current in zip(chunks, chunks[1:], strict=False):
        assert current.text.startswith(previous.text.split("\n\n")[-1])
    # Nothing is lost, and page numbers run from first to last page.
    joined = "\n\n".join(chunk.text for chunk in chunks)
    assert all(paragraph(page * 10 + i) in joined for page in range(5) for i in range(6))
    assert chunks[0].page_start == 1 and chunks[-1].page_end == 5
    assert [chunk.index for chunk in chunks] == list(range(len(chunks)))


def test_overlong_paragraph_without_punctuation_is_split() -> None:
    chunks = chunk_pages([" ".join(["word"] * 2000)], max_tokens=300, overlap_tokens=40)
    assert len(chunks) > 1
    assert all(chunk.token_estimate <= 300 for chunk in chunks)


def test_overlap_must_be_smaller_than_chunk() -> None:
    with pytest.raises(ValueError):
        chunk_pages(["text"], max_tokens=100, overlap_tokens=100)
