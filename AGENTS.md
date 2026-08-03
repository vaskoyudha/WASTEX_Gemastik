# AGENTS.md

WASTEX: waste-identification mobile app. Monorepo = Expo/React Native app at the root + FastAPI AI backend in `backend/` + Supabase for storage/auth.

## Commands

Backend (Python 3.12, managed with `uv`; project at `backend/`):
- Setup: `cd backend && uv sync --group dev` (CI runs `uv sync --group dev` from repo root)
- Dev server: `cd backend && uv run uvicorn app.main:app --reload --port 8000`
- Tests: `cd backend && uv run pytest` (or `uv run pytest backend/tests/ -v --tb=short` from root, per CI)
- Lint/format (CI gate): `uv run ruff check backend/` then `uv run ruff format --check backend/`. Ruff: line-length 100, `B008`/`BLE001` are intentionally ignored.
- Eval (not in CI, needs live server + real keys): `cd backend && uv run python eval/smoke_e2e.py`, `uv run python eval/run_ragas.py`

Frontend (root, npm):
- `npm start` / `npm run web` / `npm run android`; tests: `npm test` (jest-expo preset), single file: `npx jest <path>`
- `npm run lint:arch` = fail if `app/` imports from `src/mocks` (path alias `@/*` → `./src/*`)

## Architecture

- **Backend entrypoint is `backend/app/main.py`** (not `app.api.scan` as `backend/README.md` claims — that README is stale). Routers are mounted with prefixes in main.py (`/scan`, `/recommend`, `/skills`, `/ingest`, `/products`, `/tutorial`, `/pricing`, `/selling`, `/visuals`, `/impact`, `/auth`, `/feedback`). POST `/scan` is `router.post("")` on the `/scan` prefix.
- **Config** (`backend/app/config.py`) is pydantic-settings reading `backend/.env`; `OPENROUTER_API_KEY`, `DEEPINFRA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` are required. Tests self-configure with dummy values via `backend/tests/conftest.py`, so unit tests never hit real providers.
- **In-memory rate limiter** in `main.py`: 60 req/min per IP; test client fixture resets it. Real API clients in tests will 429.
- **Supabase migrations live in `backend/supabase/migrations/`** (numbered `YYYYMMDD*_*.sql`). The root `supabase/` dir only holds `config.toml`; local Supabase runs on ports 54321 (API) / 54322 (db). `supabase/config.toml` contains the remote project ref (`ibxnycomuwbloqaninji`).
- **Frontend API switch** (`src/services/index.ts:206`): services default to mocks unless `EXPO_PUBLIC_USE_MOCK=false`. `EXPO_PUBLIC_API_URL` defaults to `http://localhost:8000`; `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` default to the local Supabase (`localhost:54321`). Env vars are baked in at build time by Expo.
- Backend CORS allowlist (dev): `localhost:8081`, `localhost:19006`, `exp://localhost:19000` — add your machine IP for physical-device testing.

## Gotchas

- **`backend/database/.env` is tracked in git with real credentials** (commit 6ce4463). Never commit or extend `.env` files with real values; work from `.env.example` files. Root and backend `.env` files are otherwise gitignored.
- Root-level `*.py` scripts (`deploy.py`, `upload_test_data.py`, `setup_and_deploy.py`, ...) are one-off deployment experiments that reference `backend/database/` paths — prefer `scripts/` and the migration pipeline; `DEPLOYMENT.md` describes manual setup and contains stale paths.
- `metro.config.js` excludes `*.test.*` files from bundling — test-only files must not be imported by app code.
- `app.json`'s `experiments.typedRoutes` is on; run typecheck via `npx tsc --noEmit`.
- Commits target `main`; CI (`.github/workflows/ci.yml`) gates ruff + pytest. Branch naming: `feature/*` or author-name tasks.
