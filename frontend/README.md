# IntelliPrep AI — Frontend

React 19 + Vite + TypeScript. Recovered Phase 1 prototype.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build
npx tsc --noEmit   # type check
```

## Current state

Login is still simulated (IP-10 replaces it with Supabase Auth) and most study data lives in
`localStorage` until each module moves to the API. AI features call the backend through `services/`. Never put an AI provider key in this app; only `VITE_*` variables reach the
browser.

Copy `.env.example` to `.env.local` to point at a different API URL.

## Layout

```
pages/        Auth (landing + login), Dashboard, SubjectWorkspace
components/   UI primitives, Kanban/Moodboard, Copilot chat
services/     apiClient.ts (backend calls), aiService.ts (demo AI data until the backend is ready)
types.ts, constants.ts
```
