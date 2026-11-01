# IntelliPrep AI

AI-powered exam preparation that only answers from the student's own notes.
BS(CS) Final Year Project, University of Central Punjab, group S26-CS-037.

- **Team:** Muhammad Murtaza Baber Bajwa, Muhammad Alishan
- **Product Owner / Advisor:** Bilal Shahid

## Repository layout

```
frontend/      React + Vite web app (recovered Phase 1 prototype)
backend/       FastAPI API, one package per module (app/modules/*)
docs/
  phase-1-srs/   Phase 1 Software Requirements Specification (PDF)
  phase-2-sds/   Phase 2 Software Design Specification (PDF)
  scrum/         How we run Scrum, Product Backlog, Release Plan, sprint files
  architecture/  Architecture decisions that update the SDS
infra/         Deployment configuration (Terraform for the AWS phase)
automation/    n8n workflows (reminders)
archive/       Old debugging scripts kept for reference, not part of the app
```

## Start here

1. [docs/scrum/README.md](docs/scrum/README.md): roles, events, Definition of Done
2. [docs/scrum/release-plan.md](docs/scrum/release-plan.md): the 7 sprints and their goals
3. [docs/scrum/sprints/sprint-01.md](docs/scrum/sprints/sprint-01.md): the current sprint
4. [docs/architecture/decisions.md](docs/architecture/decisions.md): stack decisions

## Run locally

**Backend** (needs [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
cp .env.example .env
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend** (needs Node 20+):

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:3000, API on http://localhost:8000 (docs at `/docs`).

## Environments

| Environment | Frontend | API |
|---|---|---|
| Staging | _added in IP-04_ | _added in IP-04_ |
