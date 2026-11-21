"""Diagram and equation explanations from photos."""

import base64

import pytest
from fastapi.testclient import TestClient

from app.core import llm
from app.main import app
from app.modules.multimodal.router import Equation, Explanation, image_type

client = TestClient(app)
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 16

EXPLANATION = Explanation(
    title="Ohm's law",
    kind="equation",
    summary="The current through a resistor.",
    steps=["Voltage equals current times resistance."],
    equations=[Equation(latex="V = IR", meaning="voltage = current × resistance")],
    key_terms=["resistance"],
    readable=True,
)


@pytest.fixture
def headers(make_token):
    return {"Authorization": f"Bearer {make_token()}"}


@pytest.fixture
def vision(monkeypatch):
    calls: list = []
    result = {"value": EXPLANATION}

    async def fake_structured(instructions, input, schema, max_output_tokens=6000):
        calls.append(input)
        return result["value"]

    monkeypatch.setattr(llm, "generate_structured", fake_structured)
    return calls, result


def test_image_types_are_detected_by_content() -> None:
    assert image_type(PNG) == "image/png"
    assert image_type(JPEG) == "image/jpeg"
    assert image_type(WEBP) == "image/webp"
    assert image_type(b"%PDF-1.7") is None


def test_explains_an_image_and_sends_it_to_the_model(vision, headers) -> None:
    calls, _ = vision
    response = client.post(
        "/api/multimodal/explain",
        files={"image": ("board.png", PNG, "image/png")},
        data={"subject": "Circuits", "question": "What does R stand for?"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["equations"] == [{"latex": "V = IR", "meaning": "voltage = current × resistance"}]

    [turn] = calls[0]
    text_part, image_part = turn["content"]
    assert "Circuits" in text_part["text"] and "What does R stand for?" in text_part["text"]
    assert image_part["image_url"] == "data:image/png;base64," + base64.b64encode(PNG).decode()


def test_rejects_files_that_are_not_images(vision, headers) -> None:
    response = client.post(
        "/api/multimodal/explain",
        files={"image": ("notes.png", b"%PDF-1.7 not really a png", "image/png")},
        headers=headers,
    )
    assert response.status_code == 415
    assert vision[0] == []


def test_unreadable_photo_gets_a_clear_message(vision, headers) -> None:
    _, result = vision
    result["value"] = EXPLANATION.model_copy(update={"readable": False})
    response = client.post(
        "/api/multimodal/explain", files={"image": ("blur.jpg", JPEG, "image/jpeg")}, headers=headers
    )
    assert response.status_code == 422
    assert "couldn't be read" in response.json()["detail"]


def test_requires_login() -> None:
    response = client.post(
        "/api/multimodal/explain", files={"image": ("a.png", PNG, "image/png")}
    )
    assert response.status_code == 401
