# How we run Scrum on IntelliPrep AI

This replaces the sprint plan in the Phase 1 and Phase 2 PDFs. Those plans had errors (listed at the
bottom) and described work as done that does not exist yet. Everything below starts from the real
state of the code on **2026-11-01**: a frontend prototype and no backend.

## Product Goal

> By the final evaluation, a student can upload their own course material and use it to study with
> AI that only answers from their notes: cited answers, summaries, self-scheduling flashcards,
> quizzes that track weak topics, and exam-topic predictions from past papers. The system is
> secure, multi-user and deployed.

Every Sprint Goal moves us toward this. If a backlog item doesn't, it waits.

## Scrum Team

| Accountability | Person | What it means here |
|---|---|---|
| Product Owner | Bilal Shahid (advisor) | Owns the order of the Product Backlog. Accepts or rejects each Increment at Sprint Review. Decides scope trade-offs. |
| Scrum Master | Muhammad Alishan | Runs the events, keeps them timeboxed, removes blockers, guards the Definition of Done. Also a Developer. |
| Developers | Muhammad Murtaza Baber Bajwa, Muhammad Alishan | Plan and build the Increment. Own the Sprint Backlog. |

The advisor is not available daily, so between Reviews the team orders the backlog itself and asks
the PO only for scope or priority changes. Record those decisions in the sprint file.

**Ownership by area** (who leads, not who is allowed to touch it; both review each other's PRs):

- **Murtaza:** foundation/infra, ingestion, RAG, SM-2, Exam-Guess, groups, security hardening
- **Alishan:** frontend, auth, subjects/workspace, summaries/flashcards/quizzes, adaptive exam,
  multimodal, n8n reminders, dashboard

## Cadence

- **Sprint length:** 2 weeks, Monday to Friday of the following week. Weekends are buffer, not plan.
- **Number of sprints:** Scrum doesn't fix this. It falls out of the deadline divided by the sprint
  length. We have 7 sprints from 2026-11-02 to 2027-02-05. See [release-plan.md](release-plan.md).
- **No "Sprint 0" and no "hardening sprint".** Every sprint ends with a working, deployed
  Increment, and testing is part of Done, not a later phase.

| Event | When | Timebox | Output |
|---|---|---|---|
| Sprint Planning | Monday, day 1 | 2 h | Sprint Goal + Sprint Backlog in `sprints/sprint-NN.md` |
| Daily Scrum | Every weekday, Discord | 15 min | Plan for the next 24 h; blockers raised |
| Backlog Refinement | Wednesday, week 2 | 1 h | Next sprint's items meet Definition of Ready |
| Sprint Review | Friday, day 10, with the advisor | 1 h | Live demo on staging; PO accepts/rejects; backlog updated |
| Sprint Retrospective | Friday, day 10, after Review | 45 min | 1–2 concrete improvements added to the next Sprint Backlog |

Daily Scrum is about progress toward the Sprint Goal, not a status report. If someone is stuck for
more than half a day, say so there.

## Artifacts and their commitments

| Artifact | Commitment | Where |
|---|---|---|
| Product Backlog | Product Goal (above) | [product-backlog.md](product-backlog.md), mirrored as GitHub Issues |
| Sprint Backlog | Sprint Goal | `sprints/sprint-NN.md` + GitHub Project board |
| Increment | Definition of Done (below) | `main` branch, deployed to staging |

**Board:** GitHub Projects (not Trello), so issues, branches and PRs live in one place.
Columns: `Backlog → Ready → In Progress → In Review → Done`. "Done" means the Definition of Done is
met, not "code written".

## Definition of Ready (an item can enter a sprint when)

- It has an ID, a user story, and testable acceptance criteria
- It is estimated, and is 8 points or less (bigger items get split)
- Dependencies are done or in the same sprint
- The owner knows how they will demo it

## Definition of Done (applies to every item, every sprint)

1. Code merged to `main` through a PR reviewed and approved by the other developer
2. CI green: lint, type check, tests (backend `pytest` + `ruff`; frontend `tsc` + build)
3. New backend logic has tests: happy path, one failure path, one edge case (SRS testability NFR)
4. Endpoints require auth; new tables have row-level security policies and an isolation test
5. No secrets in code; no AI calls from the browser
6. Deployed to staging and demoed working there
7. Acceptance criteria checked off in the issue; docs updated if behaviour changed

An item that misses any of these is not Done. It goes back to the Product Backlog and does not
count toward velocity.

## Estimation

- Story points, Fibonacci (1, 2, 3, 5, 8). Anything bigger than 8 gets split.
- Reference story: **IP-20 (presigned upload + document record) = 3 points.** Estimate relative to it.
- Planning poker on Discord: both estimate privately, reveal, discuss the gap, re-vote once.
- **Velocity** = points that met Done. Our starting forecast is 22 points per sprint for the team.
  After Sprint 2, plan with the average of the last 2–3 sprints instead.

## Tracking

- **Sprint burndown:** remaining points per day, updated at Daily Scrum.
- **Release burnup:** total scope vs. points Done per sprint. Shows when scope changes, which a
  burndown hides. Kept in [release-plan.md](release-plan.md).

## Working agreements

- Branches: `feat/IP-22-pdf-chunking`, `fix/IP-03-quiz-score`. Short-lived, merged within 2 days.
- Squash-merge PRs. PR title starts with the backlog ID.
- Review within 24 hours. Pair on anything touching auth, RLS or the RAG pipeline.
- Commit messages and PRs in English; discussion in whatever is fastest.

## Templates

[templates/sprint-template.md](templates/sprint-template.md): copy to `sprints/sprint-NN.md` at
Sprint Planning.

## Corrections to the Phase 1 / Phase 2 documents

These are the problems in the PDFs that this plan fixes. Mention them in the next document revision.

1. **Point totals don't add up.** Phase 1 says 74 total points; its own sprint table sums to 89.
2. **Scrum Master is inconsistent.** Phase 1 names Murtaza on one page and Alishan on another.
3. **Missing stories.** US-07 to US-13 are referenced in the sprint table but never written.
4. **Uneven sprints.** Sprint 1 had 3 points and Sprint 4 had 21: sprints are sized by capacity, not by module.
5. **No Definition of Done or Ready.** Both are required by Scrum. Added above.
6. **Phase 2 says Sprints 1–3 are complete.** No backend exists, so the status was not true.
7. **No `subjects` table.** The UI is built around subject workspaces, but the schema has no subject entity.
8. **SM-2 needs a quality score.** SM-2 takes a 0–5 quality score; "Known/Unknown" must be mapped
   (we use Again=1, Hard=3, Good=4, Easy=5). The `flashcards` table also needs `repetitions`.
9. **AI Tutor.** Phase 2 lists the AI tutor as a future enhancement, but the frontend already shows one.
   The PO should decide whether it stays.
10. **Stack changes.** We use pgvector instead of Chroma/Pinecone, and Claude + Voyage embeddings
    instead of GPT-4o/Gemini. See [../architecture/decisions.md](../architecture/decisions.md).
