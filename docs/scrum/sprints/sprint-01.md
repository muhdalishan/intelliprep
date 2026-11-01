# Sprint 1 — Mon 2026-11-02 → Fri 2026-11-13

## Sprint Goal

> **A student can create a real account and log in on the live staging site.**

## Sprint Backlog (forecast)

| ID | Item | Owner | Pts | Status |
|---|---|---|---|---|
| IP-01 | GitHub repo + CI | Murtaza | 3 | To do |
| IP-02 | Supabase projects + migrations (`profiles`, `subjects`) | Murtaza | 3 | To do |
| IP-04 | Auto-deploy backend + frontend to staging | Murtaza | 3 | To do |
| IP-03 | Frontend stabilisation (remove browser AI key, fix 4 known bugs) | Alishan | 5 | In review: code done, needs PR review + CI + staging (IP-01, IP-04) to be Done |
| IP-10 | Real sign-up / login with Supabase Auth | Alishan | 5 | To do |
| IP-11 | Profile row on signup + `GET /api/auth/me` | Alishan | 3 | To do |

**Forecast:** 22 pts · **Capacity notes:** first sprint, velocity unknown. If it slips, IP-03's
bug fixes stay in and the API client part moves to Sprint 2.

### Task breakdown

**Murtaza**
- [ ] IP-01 Create GitHub repo, push this folder structure, protect `main` (PR + 1 review + green CI)
- [ ] IP-01 Actions workflow: backend `uv sync` → `ruff check` → `pytest`; frontend `npm ci` → `tsc --noEmit` → `vite build`
- [ ] IP-01 PR template with the Definition of Done checklist; issue per backlog item; GitHub Project board
- [ ] IP-02 Create Supabase `intelliprep-dev` and `intelliprep-staging`; enable asymmetric JWT signing keys
- [ ] IP-02 Migration tooling in `backend/migrations`; first migration: `profiles`, `subjects` (with RLS enabled)
- [ ] IP-04 Render/Railway service from `backend/Dockerfile`; Cloudflare Pages/Vercel for `frontend/`
- [ ] IP-04 Staging env vars set from `.env.example`; staging URLs added to root README

**Alishan**
- [x] IP-03 Remove `@google/genai`, `GEMINI_API_KEY` define and Gemini calls; `services/aiService.ts` returns demo data; `services/apiClient.ts` reads `VITE_API_URL`
- [x] IP-03 Fix hooks-after-early-return in `SubjectWorkspace.tsx`
- [x] IP-03 Fix double-counted final quiz answer; fix `mcqCount`/`frqCount`; add Exam + Weak Topics to sidebar; Overview "Practice Quizzes" opens the quiz tab
- [x] IP-03 Remove fake landing-page stats/testimonials/badges, AI Studio import map and missing `index.css`; `npm run typecheck` passes
- [ ] IP-10 Add `@supabase/supabase-js`; sign-up / login / logout; `ProtectedRoute` uses the real session
- [ ] IP-11 DB trigger: insert `profiles` row on `auth.users` insert; frontend sends bearer token; `/api/auth/me` shown in header
- [ ] IP-11 Tests: valid token → 200, expired → 401, missing → 401

## Burndown

| Day | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Remaining | 22 | | | | | | | | | |

## Decisions and scope changes during the sprint

- 2026-11-01: IP-03 started a day early. Found during the work, not fixed (add to backlog at refinement):
  "Ask Tutor AI" on Weak Topics sends the user to Overview, where no tutor chat exists; the floating
  Copilot is the only chat. Tailwind still loads from its CDN script (fine for dev, replace before release).

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
