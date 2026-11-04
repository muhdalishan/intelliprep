# Sprint 1 — Mon 2026-11-02 → Fri 2026-11-13

## Sprint Goal

> **A student can create a real account and log in on the live staging site.**

## Sprint Backlog (forecast)

| ID | Item | Owner | Pts | Status |
|---|---|---|---|---|
| IP-01 | GitHub repo + CI | Murtaza | 3 | In progress: local repo, CI and templates done; push + branch protection pending |
| IP-02 | Supabase projects + migrations (`profiles`, `subjects`) | Murtaza | 3 | In progress: first migration written; Supabase projects not created yet |
| IP-04 | Auto-deploy backend + frontend to staging | Murtaza | 3 | To do |
| IP-03 | Frontend stabilisation (remove browser AI key, fix 4 known bugs) | Alishan | 5 | In review: code done, needs PR review + CI + staging (IP-01, IP-04) to be Done |
| IP-10 | Real sign-up / login with Supabase Auth | Alishan | 5 | To do |
| IP-11 | Profile row on signup + `GET /api/auth/me` | Alishan | 3 | In progress: backend + tests done; frontend header waits for IP-10 |

**Forecast:** 22 pts · **Capacity notes:** first sprint, velocity unknown. If it slips, IP-03's
bug fixes stay in and the API client part moves to Sprint 2.

### Task breakdown

**Murtaza**
- [ ] IP-01 Create GitHub repo, push this folder structure, protect `main` (PR + 1 review + green CI)
- [x] IP-01 Actions workflow: backend `uv sync` → `ruff check` → `pytest`; frontend `npm ci` → `tsc --noEmit` → `vite build`
- [x] IP-01 PR template with the Definition of Done checklist and issue templates
- [ ] IP-01 Issue per backlog item; GitHub Project board
- [ ] IP-02 Create Supabase `intelliprep-dev` and `intelliprep-staging`; enable asymmetric JWT signing keys
- [x] IP-02 First migration in `backend/supabase/migrations`: `profiles`, `subjects`, `class_slots`, all with RLS
- [ ] IP-02 Apply it to dev and staging with `supabase db push`
- [ ] IP-04 Render/Railway service from `backend/Dockerfile`; Cloudflare Pages/Vercel for `frontend/`
- [ ] IP-04 Staging env vars set from `.env.example`; staging URLs added to root README

**Alishan**
- [x] IP-03 Remove `@google/genai`, `GEMINI_API_KEY` define and Gemini calls; `services/aiService.ts` returns demo data; `services/apiClient.ts` reads `VITE_API_URL`
- [x] IP-03 Fix hooks-after-early-return in `SubjectWorkspace.tsx`
- [x] IP-03 Fix double-counted final quiz answer; fix `mcqCount`/`frqCount`; add Exam + Weak Topics to sidebar; Overview "Practice Quizzes" opens the quiz tab
- [x] IP-03 Remove fake landing-page stats/testimonials/badges, AI Studio import map and missing `index.css`; `npm run typecheck` passes
- [ ] IP-10 Add `@supabase/supabase-js`; sign-up / login / logout; `ProtectedRoute` uses the real session
- [x] IP-11 DB trigger: insert `profiles` row on `auth.users` insert; `/api/auth/me` reads the profile through RLS
- [ ] IP-11 Frontend sends bearer token; name from `/api/auth/me` shown in header
- [x] IP-11 Tests: valid token → 200, missing profile → 404, expired / wrong audience / wrong issuer / wrong key / missing → 401

## Burndown

| Day | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Remaining | 22 | | | | | | | | | |

## Decisions and scope changes during the sprint

- 2026-11-01: IP-03 started a day early. Found during the work, not fixed (add to backlog at refinement):
  "Ask Tutor AI" on Weak Topics sends the user to Overview, where no tutor chat exists; the floating
  Copilot is the only chat. Tailwind still loads from its CDN script (fine for dev, replace before release).
- 2026-11-02: Scope change agreed with the team: IP-06 (Gen Z polish of the existing design: font, motion, dark
  mode, copy) done on branch `feat/IP-06-genz-polish`; a full visual redesign was tried and rejected.
- 2026-11-02: Tutor companion stories IP-140/141/142 added to the backlog below the cut line; PO to order them.
- 2026-11-02: Branch `feat/IP-02-11-schema-and-profile` holds the migration and `/auth/me`. IP-10 (frontend login)
  starts after IP-06 merges, since both touch `Auth.tsx`.

## Sprint Review (Fri 2026-11-13, with Bilal Shahid)

- **Demo:** open staging URL → sign up → log in → see own name from `/api/auth/me` → log out.
- **Also ask the PO:** confirm the final evaluation date; decide the Study Groups trade-off (see release plan).
- **Accepted:**
- **Not Done:**
- **Velocity:**

## Retrospective

- **Went well:**
- **Didn't go well:**
- **We will change:**
- 2026-11-02: While account setup (GitHub push, Supabase projects) waits on the team, the pure-logic parts of
  later items were built ahead, each on its own branch with tests; they are not Done until their API,
  storage and UI parts land in their planned sprints:
  `feat/IP-50-sm2-scheduler` (SM-2 + streak, flashcards tables), `feat/IP-22-pdf-chunking` (PDF extraction,
  chunking, documents/chunks tables), `feat/IP-61-exam-guess-ranking` (topic clustering and ranking,
  past paper tables). Their points stay in Sprints 2, 4 and 6.
- 2026-11-02: OpenAI key added (decision 008). Branch `feat/IP-40-42-ai-generation`: backend endpoints for
  summaries, flashcards, quizzes, a notes-based exam-topic estimate and the tutor chat (text and voice
  style), all through one AI module; the frontend now calls them instead of demo data. Tested live.
  Saving results and retrieval over stored documents still wait for Supabase, so IP-40/41/42/140 stay
  open. Local runs without Supabase use a fixed dev user (only when ENVIRONMENT=local and SUPABASE_URL
  is empty).
- 2026-11-02: Branch `develop` merges every feature branch for running and testing everything together;
  `main` stays the reviewed baseline. Open PRs from each feature branch (or from develop) when pushing.
- 2026-11-02: Branch `feat/IP-141-142-nova-assistant`: Nova, the voice assistant ("Hey Nova" wake word, tap to
  talk, or type), separate from the text Study Tutor. Nova sets reminders (they pop up and are spoken when
  due), saves notes to the moodboard, adds planner tasks and opens sections. Planner, moodboard and
  reminders now persist per subject in the browser. Voice works in Chrome/Edge, not in the in-app browser.
- 2026-11-03: Branch `feat/IP-90-91-study-groups` (pulled ahead from below the cut line at the team's request):
  study groups with invite codes, sharing one or many subjects per group, shared planner and moodboard
  for shared subjects, group chat, lead/member roles. Access rules are enforced by Postgres row-level
  security and tested against a real embedded Postgres (13 policy tests + 3 API tests with three
  students). Frontend Study Groups tab replaces the simulated "Study Guild". Goes live once Supabase
  accounts (IP-10) and account-synced subjects (IP-14) are connected; group Q&A over members' notes
  (rest of IP-91) waits for retrieval (IP-31).
- 2026-11-03: Branch `feat/local-database-mode`: `DATABASE_URL=local` runs a real Postgres in `backend/.localdb`
  with every migration and three test students (Ali, Sara, Hamza), switchable with "Testing as". Browser
  subjects can be saved to the account when shared; shared subjects appear on the dashboard and use the
  shared planner and moodboard; Nova writes to them. Tested in the app: Ali shares a subject, Sara joins
  by code, both edit one planner and chat; Hamza sees nothing.
- 2026-11-03: Branch `feat/ux-cleanup`, from a full UX review. Removed made-up content (fake stats, testimonials,
  sample reminders), so every number on the dashboard and subject overview is now real. Features that aren't
  connected yet (Google sign-in, forgot password, Telegram and email reminders, adaptive exams, change
  password, delete account) stay visible with a "Soon" label instead of being removed. The subject
  workspace went from 12 tabs to 7 sections with a phone bottom bar. Results (summaries, decks, quizzes,
  predictions) now persist per subject, and history buttons work. New pages: Groups, Settings, About,
  Privacy (discloses that notes go to OpenAI for processing), Terms, and a not-found page. Browser
  alert/confirm pop-ups are replaced by in-app messages and confirmation dialogs. Favicon and meta tags added.
- 2026-11-04: Five modules built ahead of plan, each on its own branch with tests (114 backend tests pass):
  RAG (`feat/IP-30-34-rag`: embeddings, hybrid search with reciprocal rank fusion, cited answers, document
  library; indexing runs as a background task until the Redis worker, IP-21), Diagrams (`feat/IP-80-diagrams`:
  photo to step-by-step explanation with KaTeX equations; photos not stored until IP-20), Adaptive exam
  (`feat/IP-70-71-adaptive-exam`: two-in-a-row difficulty rule, weak-topic focus, answers sealed in encrypted
  tokens), Reminders (`feat/IP-110-111-reminders`: server-side reminders, in-process scheduler with SKIP LOCKED,
  quiet hours, retries, Telegram and email through a signed n8n webhook; needs the bot and workflow set up;
  daily digest IP-111 not built) and the Dashboard API (`feat/IP-120-dashboard-api`). AI Studio prototype
  leftovers removed. Points move to Done only after PR review, CI and staging (DoD).
