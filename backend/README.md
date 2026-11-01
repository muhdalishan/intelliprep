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
