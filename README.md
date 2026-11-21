# IntelliPrep AI

Exam preparation from your own notes. Upload lecture PDFs and past papers, and IntelliPrep turns
them into summaries, flashcards with spaced repetition, quizzes that track weak topics, adaptive
mock exams and likely exam topics. Study alone or with classmates in group chats, with Nova, an
assistant you can type or talk to.

## Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS (`frontend/`)
- **Backend:** FastAPI, SQLAlchemy (async), Python 3.12 (`backend/`)
- **Database and auth:** Supabase (Postgres with row-level security, pgvector, Supabase Auth)
- **AI:** OpenAI (generation and embeddings)
- **Hosting:** Netlify (frontend), Render (API, Docker)

## Repository

```
backend/
  app/                 API, one package per feature (app/modules/*)
  supabase/migrations/ Database schema, applied in filename order
  tests/               pytest suite (database tests use an embedded Postgres)
  Dockerfile
frontend/
  pages/, components/, services/, hooks/
  netlify.toml
render.yaml            Render blueprint for the API
```

## Run locally

Backend (needs [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
cp .env.example .env        # set ENVIRONMENT=local, DATABASE_URL=local and OPENAI_API_KEY
uv sync
uv run uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

`DATABASE_URL=local` runs a private Postgres on your machine, so no Supabase project is needed for
development. Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, sign-in runs in a local test
mode.

## Tests

```bash
cd backend && uv run ruff check . && uv run pytest
cd frontend && npm run typecheck && npm run build
```

CI runs both on every pull request.

## Configuration

| Where | Variables |
|---|---|
| API (`backend/.env`, Render) | `ENVIRONMENT`, `DATABASE_URL`, `SUPABASE_URL`, `CORS_ORIGINS`, `SIGNING_SECRET`, `OPENAI_API_KEY`, optional `AI_REQUESTS_PER_MINUTE`, `AI_DAILY_TOKEN_BUDGET`, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME` |
| Website (`frontend/.env.local`, Netlify) | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

In production the API refuses to start if a required setting is missing and says which one.

## License

Final Year Project, BS Computer Science, University of Central Punjab. All rights reserved.
