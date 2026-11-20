# IntelliPrep AI · Kanban board

**Updated 21 November 2026 · Sprint 2 of 7 (16–27 Nov) · Final demo after 5 February 2027**

Where every backlog item stands, from the [product backlog](docs/scrum/product-backlog.md) (199 points).
Owners: **MB** Murtaza · **MA** Alishan · **You** both. Priority: **M** Must · **S** Should · **C** Could.

| Column | Items | Points | Share |
|---|---:|---:|---|
| ⚠️ Needs you (setup, not code) | 6 | – | blocks going live |
| ✅ Done (built and tested locally) | 21 | 109 | `███████████░░░░░░░░░` 55% |
| 🟡 In progress (partly built) | 13 | 49 | `█████░░░░░░░░░░░░░░░` 25% |
| 📋 To do (planned in sprints) | 9 | 24 | `██░░░░░░░░░░░░░░░░░░` 12% |
| 💤 Later (below the cut line) | 5 | 17 | `██░░░░░░░░░░░░░░░░░░` 8% |
| **Total** | **48** | **199** | |

> **About "Done":** by our Definition of Done, a story is only Done once it's reviewed in a pull
> request, CI is green and it works on staging. Nothing is on GitHub or staging yet, so ✅ here means
> *built and tested on the laptop*. Each card still needs that last step.

---

## ⚠️ Needs you: setup, not code

Nothing below needs new code; it needs accounts and clicks. Until these are done, the app exists on one laptop only.

- [ ] **Push to GitHub** (IP-01, MB): fix access (`muhdaliyan` vs `muhdalishan`), push `main` and `develop`, protect `main`, let CI run on the first PR.
- [ ] **Create the Supabase project** (IP-02, MB): `supabase db push` the 11 migrations, set redirect URLs and email sending (LAUNCH.md step 1).
- [ ] **Deploy** (IP-04, MB): backend on Render from `render.yaml`, frontend on Netlify (LAUNCH.md steps 2–3).
- [ ] **Telegram bot and n8n workflow** (IP-110, MA): steps in [automation/README.md](automation/README.md); then set `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`.
- [ ] **OpenAI monthly spending limit** (You): set it in the OpenAI dashboard before the app is online.
- [ ] **`SIGNING_SECRET` on staging** (MB): a long random value, so sealed tokens survive restarts.

---

## ✅ Done: built and tested locally (109 points)

| ID | Card | Owner | Pts | Notes |
|---|---|---|---:|---|
| IP-03 | Frontend stabilised: browser AI key removed, 4 bugs fixed, fake stats removed | MA | 5 | |
| IP-22 | PDF text extraction and structure-aware chunking (500 tokens, 60 overlap) | MB | 5 | |
| IP-40 | Summaries saved to history; summaries of saved documents cite pages | MA | 5 | on screen for account subjects |
| IP-41 | Flashcard decks saved with SM-2 starting values | MA | 3 | on screen for account subjects |
| IP-42 | Saved quizzes scored on the server, answers hidden by the database; weak topics | MA | 8 | on screen; answers shown after submitting |
| IP-50 | SM-2 scheduler and streak, now used by the review endpoint | MB | 3 | |
| IP-51 | "Due today" queue and Again / Hard / Good / Easy ratings, in the student's time zone | MB | 5 | on screen for account subjects |
| IP-60 | Past-paper upload; questions extracted by the AI and embedded | MB | 5 | on screen for account subjects |
| IP-61 | Topics ranked from past papers (frequency × recency), named by the AI | MB | 8 | on screen once 3 papers are read |
| IP-30 | Embeddings in pgvector (OpenAI, 1024 dimensions) | MB | 5 | indexed in the background |
| IP-31 | Hybrid search: vectors + full text, reciprocal rank fusion, row-level security | MB | 5 | |
| IP-34 | "Ask your notes" with page citations; "not in your notes" when nothing fits | MB | 3 | |
| IP-70 | Adaptive exam: two-in-a-row rule, weak-topic focus, sealed answers | MA | 8 | |
| IP-71 | Live difficulty meter and by-topic report | MA | 3 | |
| IP-80 | Diagrams and equations from photos, rendered with KaTeX | MA | 5 | photos not stored yet |
| IP-90 | Study groups: invite codes, roles, share subjects, leave, remove | MB | 5 | local database |
| IP-110 | Reminders: scheduler, quiet hours, retries, inbox, Telegram and email channels | MA | 5 | needs bot and n8n setup |
| IP-120 | Dashboard API and the "Coming up" card; adds weak topics and quiz scores | MA | 5 | |
| IP-130 | Rate limit, daily AI budget per student, security headers, injection tests | MB | 5 | |
| IP-141 | Nova voice: "Hey Nova" wake word, tap to talk, spoken replies | MA | 5 | Chrome and Edge only |
| IP-142 | Nova actions: reminders, notes, tasks, open sections (checked by the server) | MB | 8 | |

**Also done (outside the backlog points):**
- [x] IP-06 design polish
- [x] UX cleanup: real numbers, 7 sections, Settings and Groups pages, Privacy and Terms, in-app dialogs
- [x] Responsive design for phones, tablets and laptops
- [x] Local database mode with three test students
- [x] AI Studio leftovers removed
- [x] Scrum docs, decision records, Project Report and System Design PDFs

---

## 🟡 In progress: partly built (49 points)

| ID | Card | Owner | Pts | What's left |
|---|---|---|---:|---|
| IP-01 | Repo, CI workflow, PR and issue templates | MB | 3 | push, branch protection, project board |
| IP-02 | Supabase migrations (6) with row-level security | MB | 3 | create the projects and apply |
| IP-10 | Real sign-up, login, logout and password reset with Supabase Auth | MA | 5 | connect the Supabase project, set up email sending (LAUNCH.md) |
| IP-11 | Profile on sign-up and `/auth/me` | MA | 3 | check against the real Supabase project |
| IP-12 | Isolation tests (groups, search, reminders, dashboard) | MB | 5 | cover every endpoint |
| IP-13 | Profile settings | MA | 3 | name and avatar to the database; avatar in Storage |
| IP-14 | Subjects saved to the account | MA | 3 | new subjects and delete done; move subjects made before accounts |
| IP-21 | Background processing with status and failure reason | MB | 3 | Redis + arq worker, automatic retries |
| IP-26 | Document library with live status and delete | MA | 3 | retry failed documents; delete the stored file |
| IP-91 | Shared planner, board and chat in groups | MB | 8 | group Q&A across members' notes |
| IP-100 | Planner API (used by shared subjects) | MA | 3 | personal planners off the browser |
| IP-101 | Board API (used by shared subjects) | MA | 2 | personal boards off the browser |
| IP-140 | Study Tutor text chat (now part of Nova: one assistant) | MA | 5 | answer from the built search, with citations |

---

## 📋 To do: planned in sprints (24 points)

| Sprint | ID | Card | Owner | Pts | Pri |
|---|---|---|---|---:|---|
| 1 · Nov 2–13 | IP-04 | Deploy backend and frontend (Render + Netlify, steps in LAUNCH.md) | MB | 3 | M |
| 2 · Nov 16–27 | IP-20 | Upload files to Supabase Storage with signed URLs | MB | 3 | M |
| 3 · Nov 30–Dec 11 | IP-05 | Sentry error tracking and Langfuse AI tracing | MA | 2 | S |
| 5 · Dec 28–Jan 8 | IP-32 | Rerank the top passages before answering | MB | 2 | S |
| 5 · Dec 28–Jan 8 | IP-35 | Retrieval test set (30 real questions), measured each sprint | MB | 3 | S |
| 6 · Jan 11–22 | IP-62 | Prediction drill-down and "Add to plan" | MB | 3 | S |
| 7 · Jan 25–Feb 5 | IP-131 | End-to-end test of the student journey (Playwright) | MA | 3 | S |
| 7 · Jan 25–Feb 5 | IP-132 | Load test with 10 users (k6) | MB | 2 | S |
| 7 · Jan 25–Feb 5 | IP-133 | Demo account, demo script, backup recordings | MB | 3 | M |

---

## 💤 Later: below the cut line (17 points)

Pulled in only if velocity allows.

| ID | Card | Owner | Pts |
|---|---|---|---:|
| IP-23 | Scanned and handwritten pages read with a vision model | MB | 5 |
| IP-24 | Slide decks (PPTX) with speaker notes | MB | 2 |
| IP-25 | Lecture audio transcription | MB | 5 |
| IP-33 | Contextual chunk enrichment | MB | 3 |
| IP-111 | Daily digest of due cards | MA | 2 |

## 🚫 Won't (this release)

Mobile app · LMS integration · FSRS algorithm · offline review · instructor dashboard.

---

## 🐞 Known issues

- [ ] Real sign-in (Supabase) is built but switches on only once the Supabase keys are set; see LAUNCH.md.
- [ ] Uploaded files and diagram photos aren't kept yet, only their text and explanations (IP-20).
- [ ] Background work runs inside the API process: a crash mid-job loses that job (IP-21).
- [ ] New subjects are saved to the account; subjects made earlier in a browser (before accounts) keep their study data in that browser.
- [ ] Switching to Claude or Gemini isn't wired up yet; only OpenAI works. The docs say one setting; that comes when we add providers.
- [ ] Local database can time out after the laptop sleeps (start it with `pg_ctl ... -t 120`, see the Project Report).
- [ ] Voice works in Chrome and Edge only; typing to Nova works everywhere.
- [ ] Tailwind loads from a CDN and the bundle is over 500 kB.

---

## How to keep this board current

1. Move a card when its pull request merges, not before.
2. Update the points in the summary table, and the date at the top.
3. At each Sprint Review, compare with the [release plan](docs/scrum/release-plan.md) and pull the next items in.

Full detail: [Project Report](docs/IntelliPrep-AI-Project-Report.pdf) · [System Design](docs/IntelliPrep-AI-System-Design.pdf) · [Sprint 1 log](docs/scrum/sprints/sprint-01.md)
