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

This is still the prototype: login is simulated (IP-10 replaces it with Supabase Auth), data lives
in `localStorage`, and AI features return demo data from `services/aiService.ts` until each backend
endpoint is built. Never put an AI provider key in this app; only `VITE_*` variables reach the
browser.

Copy `.env.example` to `.env.local` to point at a different API URL.

## Layout

```
pages/        Auth (landing + login), Dashboard, SubjectWorkspace
components/   UI primitives, Kanban/Moodboard, Copilot chat
services/     apiClient.ts (backend calls), aiService.ts (demo AI data until the backend is ready)
types.ts, constants.ts
```
