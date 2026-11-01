# Product Backlog

Ordered by priority inside each epic. The PO (Bilal Shahid) owns the order; the team refines it
every Wednesday of week 2. Points are Fibonacci, relative to IP-20 = 3.

**Priority (MoSCoW):** **M**ust: the Product Goal fails without it · **S**hould: important, planned if
velocity allows · **C**ould: nice to have · **W**on't (this release).

**Owner:** **MB** = Murtaza · **MA** = Alishan

**Totals:** Must 107 · Should 62 · Could 12 · **All 181 points**

---

## E0 — Foundation and delivery

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-01 | As the team, we want a GitHub repo with CI so every change is checked automatically. | Repo with branch protection on `main`; Actions run `ruff`, `pytest`, `tsc`, `vite build` on every PR; PR template with DoD checklist. | 3 | M | MB |
| IP-02 | As the team, we want a Supabase project and versioned migrations so the schema is reproducible. | Supabase dev + staging projects; migrations in `backend/migrations` applied by one command; `profiles` and `subjects` tables created. | 3 | M | MB |
| IP-03 | As a student, I want the existing frontend to be stable so the prototype doesn't break during demos. | Gemini key and calls removed from the browser; API client module calls the backend; the four known bugs fixed (hooks after early return, double-counted quiz score, `mcqCount`/`frqCount` type error, unreachable Exam and Weak Topics tabs); `tsc` passes. | 5 | M | MA |
| IP-04 | As the team, we want automatic deploys so every merged change is on staging. | Backend on Render/Railway, frontend on Cloudflare Pages/Vercel; deploy on merge to `main`; staging URL in README. | 3 | M | MB |
| IP-05 | As the team, we want error tracking and LLM tracing so we can find problems before the demo. | Sentry on frontend and backend; Langfuse traces every LLM call with tokens and cost. | 2 | S | MA |

## E1 — Accounts and access

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-10 | As a student, I want to sign up and log in so my data is mine. | Supabase Auth email/password in the UI replaces the localStorage flag; duplicate email shows an error; logout clears the session; protected routes redirect to login. | 5 | M | MA |
| IP-11 | As a student, I want my profile created when I register so the app knows who I am. | DB trigger creates a `profiles` row on signup; `GET /api/auth/me` returns it; expired/invalid token returns 401. | 3 | M | MA |
| IP-12 | As a student, I want my notes invisible to every other user. | RLS on every table (select/insert/update/delete by `auth.uid()`); automated test: user B gets nothing from user A's data on every endpoint built so far. | 5 | M | MB |
| IP-13 | As a student, I want to set my name, avatar and notification channel. | Profile edit saved to DB; avatar stored in Supabase Storage; channel = Telegram / WhatsApp / none. | 3 | S | MA |

## E2 — Subjects and workspace

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-14 | As a student, I want my subjects saved so they appear on any device. | Subjects CRUD API + UI replaces localStorage; mock subjects removed; delete asks for confirmation. | 3 | M | MA |
| IP-100 | As a student, I want my Kanban tasks saved so my plan persists. | Tasks API (`GET/POST/PATCH/DELETE /api/workspace/tasks`); drag-and-drop updates status; per subject. | 3 | S | MA |
| IP-101 | As a student, I want my moodboard notes saved. | Notes positions and text persisted per subject. | 2 | C | MA |

## E3 — Document ingestion

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-20 | As a student, I want to upload a PDF to a subject. | Presigned upload to Supabase Storage (file never passes through the API); `documents` row with status `uploaded`; max size enforced; type checked by file signature. | 3 | M | MB |
| IP-21 | As the system, I want slow jobs in background workers so the API stays fast. | Redis queue (arq) worker; job retries 3× then marks the document `failed` with a reason; worker runs on staging. | 3 | M | MB |
| IP-22 | As a student, I want my PDF turned into searchable chunks. | Text extracted (pypdf/Docling, no AGPL libraries); chunks of 300–500 tokens with page numbers; 50-page PDF processed in ≤ 30 s; chunk count stored. | 5 | M | MB |
| IP-23 | As a student, I want scanned and handwritten notes to work. | Image/scanned PDF pages read with Claude vision; low-confidence pages flagged to the user. | 5 | S | MB |
| IP-24 | As a student, I want to upload slide decks. | PPTX text and speaker notes extracted with slide numbers. | 2 | S | MB |
| IP-25 | As a student, I want to upload lecture audio. | MP3/WAV up to 60 min transcribed in the background (≤ 10 min); transcript chunked like a PDF. | 5 | C | MB |
| IP-26 | As a student, I want to see my documents and their processing status. | Document library per subject from the API; live status (uploaded / processing / completed / failed); retry on failure; delete removes file, chunks and embeddings. | 3 | M | MA |

## E4 — Retrieval (RAG)

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-30 | As the system, I want chunks embedded so they can be searched by meaning. | Voyage embeddings stored in pgvector with HNSW index; batch embedding in the ingestion job; chunk rows carry `user_id` and are covered by RLS. | 5 | M | MB |
| IP-31 | As the system, I want accurate retrieval from only the student's notes. | Hybrid search (Postgres full-text + vector, merged with reciprocal rank fusion); scoped to user + subject; top-k returned in ≤ 2 s. | 5 | M | MB |
| IP-32 | As a student, I want the most relevant passages used. | Reranker (Voyage/Cohere) on the top 50 → top 8–10. | 2 | S | MB |
| IP-33 | As the system, I want each chunk to carry its context so retrieval is more accurate. | One-sentence context per chunk generated at ingestion (Batch API, prompt caching) and embedded with the chunk. | 3 | C | MB |
| IP-34 | As a student, I want to ask a question and get an answer from my notes with sources. | `POST /api/rag/query`; Claude answer with page-level citations; says "not in your notes" when retrieval finds nothing relevant. | 3 | M | MB |
| IP-35 | As the team, we want to measure retrieval quality. | 30 real question/answer pairs from course notes; script reports recall@10; result recorded each sprint. | 3 | S | MB |

## E5 — AI study content

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-40 | As a student, I want a structured summary of a document or topic. | Main topics → subtopics → key points, with citations; ≤ 15 s for a 50-page document; saved to history. | 5 | M | MA |
| IP-41 | As a student, I want flashcards generated from my notes. | Structured-output generation; cards saved to a deck with initial SM-2 values (EF 2.5, interval 1, repetitions 0); flip animation kept. | 3 | M | MA |
| IP-42 | As a student, I want MCQ quizzes with a timer that track what I get wrong. | 4-option MCQs from my notes; countdown timer; submit scores server-side; explanations shown; wrong answers logged to `weak_topics`; quiz history saved. | 8 | M | MA |

## E6 — Spaced repetition (SM-2)

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-50 | As the system, I want a correct SM-2 scheduler. | Pure function with unit tests against reference values; Again/Hard/Good/Easy mapped to quality 1/3/4/5. | 3 | M | MB |
| IP-51 | As a student, I want a "Due today" queue and a streak. | `GET /api/flashcards/due` (≤ 2 s for 500 cards); rating updates schedule; streak increments when the day's queue is cleared and resets after a missed day. | 5 | M | MB |

## E7 — Exam-Guess engine

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-60 | As a student, I want to upload past papers with their year. | Past paper upload (subject, year); questions extracted to `past_paper_questions` with structured output. | 5 | M | MB |
| IP-61 | As a student, I want likely exam topics ranked with confidence. | Questions embedded and clustered; ranking by frequency × recency; confidence score; needs ≥ 3 papers; ≤ 60 s for 200 questions. | 8 | M | MB |
| IP-62 | As a student, I want to see example questions per predicted topic and turn them into tasks. | Click a topic → its past questions; "Add to plan" creates Kanban tasks. | 3 | S | MB |

## E8 — Adaptive exam simulator

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-70 | As a student, I want a mock exam that adapts to me. | Question bank weighted toward weak topics; starts Medium; difficulty moves Easy ↔ Very Hard after two consecutive correct/incorrect answers. | 8 | S | MA |
| IP-71 | As a student, I want to see how I did by topic. | Live difficulty indicator during the session; topic-by-topic score breakdown at the end; weak topics updated. | 3 | S | MA |

## E9 — Diagrams and equations

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-80 | As a student, I want a diagram or handwritten equation explained. | Image upload → structured explanation; equations returned as LaTeX and rendered with KaTeX. | 5 | S | MA |

## E10 — Study groups

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-90 | As a group lead, I want to create a group and invite classmates. | Create group → invite token; join by token; members table with roles; RLS limits group data to members. | 5 | S | MB |
| IP-91 | As a member, I want to ask questions across everyone's shared notes. | Members share documents into the group; group query draws on ≥ 2 members' notes; near-duplicate chunks (cosine ≥ 0.92) removed; each source shows which member contributed it. | 8 | S | MB |

## E11 — Reminders

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-110 | As a student, I want Telegram reminders for due cards and deadlines. | Reminders API; backend calls an n8n webhook; n8n sends via Telegram bot; quiet hours respected; delivery status stored. | 5 | S | MA |
| IP-111 | As a student, I want a daily digest of due cards. | Scheduled n8n flow sends one message per day if cards are due. | 2 | C | MA |

## E12 — Dashboard

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-120 | As a student, I want one screen showing what to do today. | `GET /api/dashboard` (≤ 3 s) returns due cards, top predictions, task counts, recent quiz scores, recent uploads, streak; all hardcoded numbers removed; fits a 1080p screen without scrolling. | 5 | M | MA |

## E13 — Quality and release

| ID | Story | Acceptance criteria | Pts | Pri | Owner |
|---|---|---|---|---|---|
| IP-130 | As the system owner, I want the API protected against abuse. | Per-user rate limits; daily LLM token budget per user; upload validation; security headers; prompt-injection test cases pass. | 5 | M | MB |
| IP-131 | As the team, we want the main student journey tested end to end. | Playwright test: sign up → upload → ask → flashcards → quiz, runs in CI against staging. | 3 | S | MA |
| IP-132 | As the team, we want to know the system handles 10 concurrent users. | k6 load test; p95 within 20% of single-user baseline (SRS NFR); results recorded. | 2 | S | MB |
| IP-133 | As the team, we want a reliable final demo. | Seed account with real course material; demo script; fallback recordings; final docs updated. | 3 | M | MB |

## Won't (this release)

Mobile app, LMS integration, FSRS algorithm, offline review, instructor dashboard, landing-page
marketing statistics (remove the fake "12,000 students / 98% pass rate" figures in IP-03 or IP-133).
