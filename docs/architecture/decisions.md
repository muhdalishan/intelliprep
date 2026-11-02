# Architecture Decisions

Short records of decisions that change or add to the Phase 2 SDS. Add a new entry instead of editing
an accepted one.

| # | Decision | Status |
|---|---|---|
| 001 | Modular monolith + background workers | Accepted |
| 002 | pgvector instead of Chroma/Pinecone | Accepted |
| 003 | Claude for generation, Voyage for embeddings | Accepted |
| 004 | Supabase Auth with backend JWT verification and row-level security | Accepted |
| 005 | No AGPL document libraries | Accepted |
| 006 | Anthropic SDK directly, no LangChain/LlamaIndex orchestration | Accepted |
| 007 | Hosting: Render/Railway + Cloudflare for the FYP, AWS later | Accepted |
| 008 | OpenAI as the AI provider for now | Accepted |

---

## 001 — Modular monolith + background workers

**Context:** Two developers, one semester, 13 modules. The SDS already requires each module to be
a separate router with no cross-module function calls.

**Decision:** One FastAPI app with a package per module (`backend/app/modules/*`). Slow work
(parsing, OCR, embeddings, clustering) runs in separate worker processes fed by a Redis queue.
API and workers scale independently.

**Consequences:** One deploy, one test suite, no network calls between modules. If a module ever
needs its own service (ingestion is the likely one), it can be split along the existing package
boundary.

## 002 — pgvector instead of Chroma/Pinecone

**Context:** The Phase 1 risk register rates cross-user vector leakage as Critical.

**Decision:** Store embeddings in Postgres (pgvector, HNSW index) in the same database as the rest
of the data.

**Consequences:** The row-level security that protects documents also protects embeddings, so
isolation is enforced by the database. Deleting a user removes their vectors in one transaction.
Re-evaluate a dedicated vector store only at hundreds of millions of vectors.

## 003 — Claude for generation, Voyage for embeddings

**Decision:** Claude (`claude-opus-5-5` by default) for summaries, quizzes, flashcards, Exam-Guess
labelling and vision. Voyage AI for embeddings and reranking (Anthropic does not offer embeddings).
Prompt caching on system prompts and document context; Batch API for ingestion-time generation.
Citations enabled for grounded answers.

**Consequences:** Replaces GPT-4o and the Gemini prototype. A cheaper model (e.g.
`claude-haiku-5-5`) may be used for bulk tasks only after comparing quality on our own eval set.
All AI calls happen in the backend.

## 004 — Supabase Auth, backend JWT verification, row-level security

**Decision:** The browser signs in with Supabase Auth. The backend verifies every access token
against Supabase's public signing keys (`app/core/security.py`). Request handlers use a DB session
that runs as the calling user (`app/db/session.py`), so Postgres RLS policies apply to every query.

**Consequences:** Two layers of access control (app code and database). Every new table needs RLS
policies and an isolation test (Definition of Done item 4).

## 005 — No AGPL document libraries

**Context:** PyMuPDF (named in the SRS) is AGPL; using it in a closed SaaS requires releasing our
source or buying a licence.

**Decision:** Use pypdf / pdfplumber / Docling (permissive licences). Use Claude vision for
scanned and handwritten pages instead of Tesseract.

## 006 — Anthropic SDK directly, no orchestration framework

**Decision:** The RAG flow is a fixed pipeline (retrieve → rerank → generate), so we write it
directly with the Anthropic Python SDK behind one internal module. Document loaders from other
libraries are allowed.

**Consequences:** Less abstraction to debug; full control of prompt caching and citations.

## 007 — Hosting

**Decision:** For the FYP: backend container on Render or Railway, frontend on Cloudflare Pages or
Vercel, Supabase for Postgres/Auth/Storage, Upstash for Redis. Production path: AWS (ECS Fargate,
RDS/Aurora, SQS, S3) using the same Docker image.

## 008 — OpenAI as the AI provider for now

**Context:** The team has an OpenAI API key; Anthropic and Voyage keys are not available yet.

**Decision:** `LLM_PROVIDER=openai` by default. OpenAI models handle generation, and OpenAI
embeddings (`text-embedding-3-small` requested at 1024 dimensions) fill the `vector(1024)` columns,
so the schema doesn't change. Claude and Voyage stay supported through the same setting. This
partly replaces decision 003.

**Consequences:** The provider sits behind one internal module, so switching later is a config
change plus re-embedding stored chunks.
