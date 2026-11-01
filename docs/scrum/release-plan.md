# Release Plan

**7 sprints × 2 weeks, 2026-11-02 → 2027-02-05.** Final demo after Sprint 7.

This is a **forecast, not a promise**. It assumes a team velocity of about 22 points per sprint
(two students, part-time) and less in Sprint 4 because of the holidays. After Sprint 2 we replace the
forecast with measured velocity and move the cut line up or down.

> **Assumption to confirm with the advisor:** final evaluation in mid-February 2027. If it is earlier,
> we keep the dates and **cut scope from the bottom of the backlog**. In Scrum the deadline and
> quality are fixed; scope is what moves.

## Sprints

| Sprint | Dates | Sprint Goal (what the PO sees at Review) | Murtaza | Alishan | Pts |
|---|---|---|---|---|---|
| 1 | Nov 2 – Nov 13 | **A student can create a real account and log in on the live staging site.** | IP-01 CI, IP-02 Supabase + migrations, IP-04 deploys | IP-03 frontend fixes, IP-10 Supabase login, IP-11 profile + `/auth/me` | 22 |
| 2 | Nov 16 – Nov 27 | **A student can upload a PDF to a subject and watch it get processed.** | IP-12 RLS + isolation tests, IP-20 upload, IP-21 workers, IP-22 PDF chunking | IP-14 subjects, IP-26 document library, IP-13 profile settings | 25 |
| 3 | Nov 30 – Dec 11 | **A student can ask their notes a question and get a cited answer and a summary.** | IP-30 embeddings, IP-31 hybrid search, IP-34 cited Q&A | IP-40 summaries, IP-05 Sentry/Langfuse, IP-100 Kanban saved | 23 |
| 4 | Dec 14 – Dec 25 | **A student reviews flashcards that schedule themselves.** (reduced capacity) | IP-50 SM-2, IP-51 due queue + streak | IP-41 flashcard generation, IP-101 moodboard saved | 13 |
| 5 | Dec 28 – Jan 8 | **Quizzes record weak topics, and the dashboard shows real progress.** | IP-32 reranking, IP-35 retrieval eval, IP-60 past papers | IP-42 quizzes + weak topics, IP-120 dashboard | 23 |
| 6 | Jan 11 – Jan 22 | **A student gets exam-topic predictions from their own past papers.** | IP-61 clustering + ranking, IP-62 topic drill-down | IP-70 adaptive exam engine, IP-110 Telegram reminders | 24 |
| 7 | Jan 25 – Feb 5 | **Adaptive exam complete; the product is secure, tested and demo-ready.** | IP-130 abuse protection, IP-132 load test, IP-133 demo prep | IP-71 exam breakdown, IP-131 E2E test, IP-80 diagrams | 21 |

**Planned: 151 of 181 points.** All **Must** items (107 points) are in Sprints 1–7.

## Below the cut line (pulled in only if velocity is higher than forecast)

| ID | Item | Pts |
|---|---|---|
| IP-90 | Study groups: create / join | 5 |
| IP-91 | Group query with member attribution + dedup | 8 |
| IP-23 | Scanned / handwritten notes via Claude vision | 5 |
| IP-24 | PPTX upload | 2 |
| IP-33 | Contextual chunk enrichment | 3 |
| IP-25 | Lecture audio transcription | 5 |
| IP-111 | Daily digest | 2 |

**Decision needed from the PO:** Study Groups (IP-90/91, 13 points) is a full module in the SRS but
sits below the line. The trade-off options:

- Keep the plan, with groups as the first item pulled in if velocity allows
- Swap groups with the adaptive exam (IP-70/71, 11 points)
- Drop diagrams (IP-80) and Telegram reminders (IP-110) to fit groups in

Bring this to the Sprint 1 Review.

## Release burnup (update at every Sprint Review)

| After sprint | Total scope (pts) | Done (pts) | Velocity |
|---|---|---|---|
| 0 (today) | 181 | 0 | — |
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |

## Risks to the plan

| Risk | Effect | Response |
|---|---|---|
| Exams / assignments in other courses | Velocity drops | Plan with measured velocity; cut from the bottom, never skip Done |
| One developer blocked or away | Half the sprint stalls | Both review each other's PRs, so each knows the other's area |
| LLM API costs or rate limits during demo | Demo fails | Per-user budgets (IP-130), cached seed data, recorded fallback (IP-133) |
| Cross-user data leak | Critical failure | RLS + isolation tests from Sprint 2 (IP-12), checked on every new table via DoD |
| Retrieval quality poor on real notes | AI answers look wrong | Eval set (IP-35) measured each sprint from Sprint 5 |
