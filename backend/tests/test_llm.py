"""The AI gateway's embedding call: batching, order and errors."""

import asyncio
from types import SimpleNamespace

import openai
import pytest

from app.core import llm


class FakeEmbeddings:
    def __init__(self, fail: bool = False):
        self.calls: list[dict] = []
        self.fail = fail

    async def create(self, model, input, dimensions):
        self.calls.append({"model": model, "count": len(input), "dimensions": dimensions})
        if self.fail:
            raise openai.APIConnectionError(request=None)
        # Return out of order: embed() must sort by index
        data = [SimpleNamespace(index=i, embedding=[float(len(t))]) for i, t in enumerate(input)]
        return SimpleNamespace(data=list(reversed(data)))


def test_embed_batches_and_keeps_order(monkeypatch) -> None:
    fake = FakeEmbeddings()
    monkeypatch.setattr(llm, "_client", lambda: SimpleNamespace(embeddings=fake))
    texts = ["x" * n for n in range(1, llm.EMBEDDING_BATCH + 6)]

    vectors = asyncio.run(llm.embed(texts))

    assert vectors == [[float(n)] for n in range(1, llm.EMBEDDING_BATCH + 6)]
    assert [c["count"] for c in fake.calls] == [llm.EMBEDDING_BATCH, 5]
    assert {c["dimensions"] for c in fake.calls} == {1024}


def test_embed_errors_become_ai_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(llm, "_client", lambda: SimpleNamespace(embeddings=FakeEmbeddings(fail=True)))
    with pytest.raises(llm.AIUnavailable):
        asyncio.run(llm.embed(["hello"]))


def test_as_vector_is_pgvector_text() -> None:
    assert llm.as_vector([0.5, -1.0]) == "[0.5000000,-1.0000000]"
