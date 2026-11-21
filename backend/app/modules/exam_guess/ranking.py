"""Exam-Guess engine: group past-paper questions into topics and rank them (IP-61).

Questions arrive already embedded. Similar questions are grouped by cosine similarity to a
running topic centroid; each topic is then scored by the papers it appeared in, with recent
papers counting more (each year back is worth RECENCY_DECAY of the year after it). The score is
divided by the score of a topic that came in every paper, so confidence runs from 0 to 1.
Topic names come later from Claude labelling each group; this module stays model-free.
"""

import math
from collections.abc import Sequence
from dataclasses import dataclass

MIN_PAPERS = 3
SIMILARITY_THRESHOLD = 0.80
RECENCY_DECAY = 0.8


class NotEnoughPapers(ValueError):
    pass


@dataclass(frozen=True)
class PastQuestion:
    id: str
    paper_id: str
    year: int
    text: str
    embedding: Sequence[float]


@dataclass(frozen=True)
class TopicPrediction:
    questions: tuple[PastQuestion, ...]
    representative: PastQuestion
    years: tuple[int, ...]
    papers_seen: int
    frequency: float
    """Share of papers this topic appeared in."""
    confidence: float
    """Recency-weighted share of papers, 0 to 1."""


def _unit(vector: Sequence[float]) -> tuple[float, ...]:
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0:
        raise ValueError("Embedding is all zeros")
    return tuple(x / norm for x in vector)


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


def cluster_questions(
    questions: Sequence[PastQuestion], threshold: float = SIMILARITY_THRESHOLD
) -> list[list[PastQuestion]]:
    """Greedy centroid clustering, oldest paper first so results are deterministic."""
    groups: list[list[PastQuestion]] = []
    sums: list[list[float]] = []
    for question in sorted(questions, key=lambda q: (q.year, q.paper_id, q.id)):
        vector = _unit(question.embedding)
        best, best_similarity = -1, threshold
        for index, total in enumerate(sums):
            similarity = _dot(vector, _unit(total))
            if similarity >= best_similarity:
                best, best_similarity = index, similarity
        if best == -1:
            groups.append([question])
            sums.append(list(vector))
        else:
            groups[best].append(question)
            sums[best] = [s + v for s, v in zip(sums[best], vector, strict=True)]
    return groups


def predict_topics(
    questions: Sequence[PastQuestion],
    threshold: float = SIMILARITY_THRESHOLD,
    decay: float = RECENCY_DECAY,
) -> list[TopicPrediction]:
    paper_years = {q.paper_id: q.year for q in questions}
    if len(paper_years) < MIN_PAPERS:
        raise NotEnoughPapers(
            f"Upload at least {MIN_PAPERS} past papers to predict topics "
            f"({len(paper_years)} so far)."
        )

    latest = max(paper_years.values())
    weight = {paper: decay ** (latest - year) for paper, year in paper_years.items()}
    all_papers_weight = sum(weight.values())

    predictions = []
    for group in cluster_questions(questions, threshold):
        papers = {q.paper_id for q in group}
        centroid = _unit(
            [sum(values) for values in zip(*(_unit(q.embedding) for q in group), strict=True)]
        )
        predictions.append(
            TopicPrediction(
                questions=tuple(group),
                representative=max(group, key=lambda q: _dot(_unit(q.embedding), centroid)),
                years=tuple(sorted({q.year for q in group})),
                papers_seen=len(papers),
                frequency=len(papers) / len(paper_years),
                confidence=round(sum(weight[p] for p in papers) / all_papers_weight, 4),
            )
        )
    predictions.sort(key=lambda t: (-t.confidence, -t.frequency, -len(t.questions)))
    return predictions
