import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.documents import router as documents
from tests.test_documents import make_pdf

client = TestClient(app)


@pytest.fixture
def headers(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


def upload(data: bytes, headers: dict, name: str = "lecture.pdf"):
    return client.post(
        "/api/documents/extract", files={"file": (name, data, "application/pdf")}, headers=headers
    )


def test_extracts_text_with_page_markers(headers) -> None:
    pdf = make_pdf([["Lecture 6: Balanced Trees", "AVL trees rotate."], [], ["Hashing basics"]])
    response = upload(pdf, headers)
    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "lecture.pdf"
    assert body["page_count"] == 3
    assert body["empty_pages"] == [2]
    assert body["chunk_count"] == 1
    assert body["text"].startswith("--- Page 1 ---\nLecture 6: Balanced Trees")
    assert "--- Page 3 ---\nHashing basics" in body["text"]
    assert "--- Page 2 ---" not in body["text"]


def test_rejects_non_pdf_with_readable_message(headers) -> None:
    response = upload(b"just some text", headers, name="notes.pdf")
    assert response.status_code == 422
    assert response.json()["detail"] == "This file isn't a PDF."


def test_rejects_oversized_upload(headers, monkeypatch) -> None:
    monkeypatch.setattr(documents, "MAX_UPLOAD_BYTES", 100)
    response = upload(make_pdf([["x" * 50]] * 3), headers)
    assert response.status_code == 413


def test_upload_requires_sign_in() -> None:
    response = client.post(
        "/api/documents/extract", files={"file": ("a.pdf", b"%PDF-", "application/pdf")}
    )
    assert response.status_code == 401
