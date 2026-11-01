import pytest

from app.modules.exam_guess.ranking import (
    NotEnoughPapers,
    PastQuestion,
    cluster_questions,
    predict_topics,
)

# Three clearly separate topics, with small wording differences inside each.
AVL = [1.0, 0.05, 0.0]
AVL_PARAPHRASE = [0.97, 0.0, 0.08]
HASHING = [0.0, 1.0, 0.05]
HEAPS = [0.05, 0.0, 1.0]


def q(qid: str, year: int, embedding: list[float]) -> PastQuestion:
    return PastQuestion(id=qid, paper_id=f"final-{year}", year=year, text=qid, embedding=embedding)


def five_years() -> list[PastQuestion]:
    return [
        q("avl-21", 2021, AVL),
        q("hash-21", 2021, HASHING),
        q("hash-22", 2022, HASHING),
        q("avl-22", 2022, AVL_PARAPHRASE),
        q("filler-23", 2023, [0.6, -0.6, -0.5]),
        q("avl-24", 2024, AVL),
        q("avl-25", 2025, AVL_PARAPHRASE),
        q("heap-25", 2025, HEAPS),
    ]


def test_paraphrased_questions_join_one_topic() -> None:
    groups = cluster_questions(five_years())
    avl = next(g for g in groups if any(x.id == "avl-21" for x in g))
    assert sorted(x.id for x in avl) == ["avl-21", "avl-22", "avl-24", "avl-25"]


def test_ranking_rewards_frequency_and_recency() -> None:
    topics = predict_topics(five_years())
    order = [t.representative.id.split("-")[0] for t in topics]

    # AVL came in 4 of 5 papers; heaps only once but in the latest paper, which beats
    # hashing's two old appearances.
    assert order[:3] == ["avl", "heap", "hash"]
    avl = topics[0]
    assert avl.years == (2021, 2022, 2024, 2025)
    assert avl.papers_seen == 4
    assert avl.frequency == pytest.approx(0.8)
    weights = {2025: 1, 2024: 0.8, 2023: 0.64, 2022: 0.512, 2021: 0.4096}
    expected = (weights[2021] + weights[2022] + weights[2024] + weights[2025]) / sum(
        weights.values()
    )
    assert avl.confidence == pytest.approx(expected, abs=1e-4)
    assert all(0 < t.confidence <= 1 for t in topics)


def test_needs_three_papers() -> None:
    with pytest.raises(NotEnoughPapers, match="at least 3"):
        predict_topics([q("a", 2024, AVL), q("b", 2025, AVL)])


def test_two_papers_in_one_year_count_separately() -> None:
    questions = [
        PastQuestion("m", "mid-2025", 2025, "m", AVL),
        PastQuestion("f", "final-2025", 2025, "f", AVL),
        PastQuestion("o", "final-2024", 2024, "o", HASHING),
    ]
    topics = predict_topics(questions)
    assert topics[0].papers_seen == 2


def test_zero_embedding_is_rejected() -> None:
    with pytest.raises(ValueError, match="all zeros"):
        cluster_questions([q("z", 2025, [0.0, 0.0, 0.0])])
