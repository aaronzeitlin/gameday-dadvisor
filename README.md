# Gameday Dadvisor MVP

Gameday Dadvisor helps users connect calendars, set game ticket preferences, and get ranked game recommendations with ticket links.

## New shared planning flow (two people)
1. Go to **Plan** page and create a new plan (e.g., "Brother-in-law Baseball Plan").
2. Share the generated Plan ID/link with the other person.
3. Second person joins using the same Plan ID.
4. Each participant connects calendar providers on **Connect Calendars**.
5. Run search on **Results** to see games where all plan participants are available.

> Current MVP stores user identity via `X-User-Id` header (frontend auto-generates a local user id).

## Two-person usability (MVP)
This build now supports a practical two-person flow end-to-end:
- each person sets their own local user id on **Plan** page,
- one person creates a plan and shares `/plan?joinPlan=<id>`,
- second person opens link and auto-joins,
- each person connects at least one calendar account,
- shared search only returns games where all participants are free.

For mock calendar behavior, use these sample emails on Connect Calendars:
- `alice@example.com`
- `bob@example.com`

Their busy slots are defined in `backend/app/fixtures/freebusy.json`.

## Stack
- Backend: FastAPI (Python)
- Frontend: React + Vite + TypeScript
- DB: Postgres (docker-compose; backend currently uses in-memory persistence for MVP)
- Calendar: provider abstraction + mock free/busy implementation
- Schedules/Tickets: ESPN public scoreboard feed for supported teams by default; SeatGeek provider when credentials are configured

## Local setup
1. Copy env:
   ```bash
   cp .env.example .env
   ```
2. Generate `FERNET_KEY`:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
3. Start app:
   ```bash
   docker compose up --build
   ```
4. Open frontend at http://localhost:5173 and backend docs at http://localhost:8000/docs

## OAuth notes (MVP wiring)
- Endpoints:
  - `POST /auth/google/start`, `POST /auth/google/callback`
  - `POST /auth/microsoft/start`, `POST /auth/microsoft/callback`
- Current MVP stores encrypted mock refresh tokens with `freebusy.read` scope and supports disconnect.
- To enable real OAuth:
  - Register app in Google Cloud and Microsoft Entra
  - Add redirect URI mapping to `/auth/{provider}/callback`
  - Exchange auth code for refresh token in callback handlers

## Core APIs
- `GET /me`
- `GET /preferences`
- `PUT /preferences`
- `POST /plans`
- `POST /plans/{plan_id}/join`
- `GET /plans/{plan_id}`
- `POST /search` (supports `plan_id` for shared availability)
- `POST /disconnect/{provider}`

## Scoring factors
Weighted scoring in `backend/app/services/scoring.py`:
- price/value
- giveaways
- preferred day/time
- travel distance penalty
- availability (hard gate)

## Tests
From `backend/`:
```bash
pytest
```

## Optional deployment notes
- Render/Fly: deploy backend as web service and frontend as static/site service.
- Configure environment variables (`FERNET_KEY`, SeatGeek credentials).
- Use managed Postgres in production and replace in-memory store with SQL models.


## Ship it (fast path)
If you want to ship immediately for BIL testing:

1. Deploy **frontend only** to Vercel from `frontend/`.
2. In Vercel project settings, set:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Keep `VITE_API_URL` pointed to your backend URL if using backend mode.
4. If you run frontend-only experiments, keep mock/fixture behavior and plan-link sharing.
5. `frontend/vercel.json` includes SPA rewrites so `/plan` and deep links work.

### Reality check before public sharing
- Current app is still MVP-grade for private testing; for public use, complete auth + DB + real OAuth cut-line items below.


### Vercel 404 troubleshooting (`404: NOT_FOUND`)
If Vercel shows a 404 page like `Code: NOT_FOUND`, it usually means the project was deployed from repo root without frontend build/output mapping.

This repo now includes **root** `vercel.json` for monorepo deploys:
- install: `cd frontend && npm install`
- build: `cd frontend && npm run build`
- output: `frontend/dist`
- SPA rewrite: all routes -> `/index.html`

After adding this:
1. Redeploy from Vercel (root of repo is fine).
2. Confirm framework preset can be "Other" (config is explicit).
3. Ensure `VITE_API_URL` is set in Vercel env if backend mode is used.

## Practical production-grade MVP cut line
Use this as the go-live checklist for two real users (you + BIL):

### Must-have before go-live
- Real auth identity (server-side session/JWT) replacing client-set `X-User-Id`.
- Postgres persistence for users, plans, memberships, preferences, and connected providers.
- Real Google/Microsoft OAuth token exchange and free/busy calls.
- Secure invite/join links with expiration and membership authorization.
- Baseline operational guardrails:
  - configurable CORS (`CORS_ORIGINS`),
  - search rate limit (`SEARCH_RATE_LIMIT_PER_MINUTE`),
  - 15-minute cache for games/tickets.

### Added in this iteration
- `GET /ready` endpoint for environment readiness (Fernet + provider mode).
- Configurable CORS via env (no wildcard default).
- Search endpoint rate limiting (in-memory fixed window).
- TTL in-memory caching for game lists and ticket summaries.

### Next recommended sprint
1. Replace in-memory store with SQLAlchemy + Alembic migrations.
2. Introduce authenticated user sessions and plan-level ACL checks.
3. Add provider background token refresh jobs + retries and provider outage fallbacks.
4. Add CI checks (`pytest`, lint, typecheck) and deployment health/readiness probes.

