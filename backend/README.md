# IntelliPrep AI — Backend

FastAPI modular monolith. One deployable app, one package per module under `app/modules/`.
Slow work (parsing, OCR, embeddings, clustering) runs in background workers (added in IP-21).

## Run locally

Requires [uv](https://docs.astral.sh/uv/). uv installs Python 3.12 itself.

```bash
cd backend
cp .env.example .env      # then fill in Supabase + API keys
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Local database (before Supabase)

Set `DATABASE_URL=local` in `.env` (with `ENVIRONMENT=local` and `SUPABASE_URL` empty). The backend
then starts its own Postgres with its data in `backend/.localdb/`, applies every migration that
hasn't run yet, and creates three test students: Ali Khan, Sara Ahmed and Hamza Raza. Requests
without a login act as Ali.

To try collaboration on one computer, use the **Testing as** switch (dashboard header or a
subject's Study Groups tab) to change student. It sends an `X-Dev-User` header that the backend
only honours in this local mode. Delete `backend/.localdb/` to start over with an empty database.

## Test and lint

```bash
uv run pytest
uv run ruff check .
```

## Layout

```
app/
  main.py            app factory, router registration
  core/config.py     settings from environment (.env)
  core/security.py   Supabase JWT verification -> CurrentUser
  db/session.py      per-user DB session (Postgres row-level security)
  modules/<name>/    router.py first; add schemas.py, service.py, models.py as the module grows
tests/
```

## Module rules

- A module never imports another module's `service.py` or models. Share data through the
  database or an explicit function in that module's public interface.
- Every endpoint except `/api/health` depends on `get_current_user`.
- Database access in request handlers goes through `UserDb` (row-level security), never a
  superuser connection.
- AI keys live only here. The frontend never calls an AI provider directly.
