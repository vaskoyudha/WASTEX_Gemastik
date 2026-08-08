# AGENTS.md

WASTEX: waste-identification mobile app (Gemastik project). Monorepo = Expo/React Native app at the root + FastAPI AI backend in `backend/` + Supabase for storage/auth/RLS. `QWEN.md` is a detailed companion doc (layout, auth, RAG pipeline, testing conventions); `prd.md`/`desain.md` are product docs. `AGENTS.md` is the operational cheat-sheet.

## Commands

Backend (Python 3.12, `uv`; **all commands run from `backend/`** — there is no root pyproject, so `uv` commands fail from repo root):
- Setup: `uv sync --group dev`
- Dev server: `uv run uvicorn app.main:app --reload --port 8000`
- Tests: `uv run pytest` (single file: `uv run pytest tests/test_x.py`)
- Lint/format (CI gates, same as `.github/workflows/ci.yml` which sets `working-directory: backend`): `uv run ruff check .` then `uv run ruff format --check .`
- Eval (not in CI, needs live server + real keys): `uv run python eval/smoke_e2e.py`, `uv run python eval/run_ragas.py`

Frontend (root, npm):
- `npm start` / `npm run web` / `npm run android`; tests: `npm test` (jest-expo preset), single file: `npx jest <path>`
- Typecheck: `npx tsc --noEmit` (typedRoutes is on)
- `npm run lint:arch` = fail if `app/` imports from `src/mocks` (path alias `@/*` → `./src/*`)
- CI has **no frontend job** — only backend ruff + pytest gate on `main`.

## Architecture

- **`app/` is expo-router routes only** (e.g. `app/scan/upload.tsx`); real code lives in `src/` (components, features, services, store, types).
- **Backend entrypoint is `backend/app/main.py`** (not `app.api.scan` as `backend/README.md` claims — that README is stale). Routers mounted with prefixes: `/scan`, `/recommend`, `/skills`, `/ingest`, `/products`, `/tutorial`, `/pricing`, `/selling`, `/visuals`, `/impact`, `/auth`, `/feedback`, `/documents`. POST `/scan` is `router.post("")` on the `/scan` prefix.
- **Config** (`backend/app/config.py`) is pydantic-settings reading `backend/.env`; `OPENROUTER_API_KEY`, `DEEPINFRA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` are required. Tests self-configure dummy values in `backend/tests/conftest.py` (incl. `SUPABASE_JWT_SECRET`), so unit tests never hit real providers. Chat models MUST return strict JSON — `qd/qmodel_38max` ignores that and is unusable; don't switch to it.
- **In-memory rate limiter** in `main.py`: 60 req/min per IP sliding window; `_reset_rate_limiter` autouse fixture in conftest clears it, so real API calls in tests will 429.
- **Auth** (`backend/app/auth.py`): `get_current_user` tries HS256 with `SUPABASE_JWT_SECRET`, falls back to Supabase `auth.get_user` (ES256); `create_test_token` is for tests only. Guards in `app/deps.py` (`require_service_role`, `require_expert_or_service` check `profiles.role`).
- **Supabase migrations live in `backend/supabase/migrations/`** (numbered `YYYYMMDD*_*.sql`) — canonical. Root `supabase/` holds CLI `config.toml` plus a symlink `migrations -> ../backend/supabase/migrations`; never edit through the symlink target confusion, edit `backend/supabase/migrations/`. Local Supabase: API 54321, db 54322, Studio 54323.
- **Frontend API switch** (`src/services/index.ts:285`): `USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== "false"` — mocks are the default. `EXPO_PUBLIC_API_URL` defaults to `http://localhost:8000`; `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` default to local Supabase (`localhost:54321`). Env vars are baked in at build time by Expo.
- CORS allowlist (dev, `config.py:33`): `localhost:8080/8081/8082`, `localhost:19006`, `exp://localhost:19000` — add your machine IP for physical-device testing.

## Gotchas

- **`backend/database/.env` is tracked in git with real credentials** (commit 6ce4463). Never commit or extend `.env` files with real values; work from `.env.example`. Root and `backend/.env` are otherwise gitignored.
- Root-level `*.py` scripts (`deploy.py`, `upload_test_data.py`, `setup_and_deploy.py`, ...) are one-off deployment experiments referencing `backend/database/` paths — prefer `scripts/` and the migration pipeline; `DEPLOYMENT.md` describes manual setup but contains stale paths.
- `.gitignore` ignores `*.png` globally and `visuals/` — don't commit generated images or local image-gen playbooks.
- `metro.config.js` excludes `*.test.*`/`*.spec.*` from bundling — test-only files must not be imported by app code.
- `e2e/skill-flow.spec.ts` (Playwright) needs the full live stack (`npm run web` + backend on :8000 + `EXPO_PUBLIC_USE_MOCK=false`); there is no playwright config or npm script — run via `npx playwright test`. Jest ignores `/e2e/`.
- `docs/superpowers/specs/` + `plans/` hold design specs and implementation plans; the newest plan is the current focus area. Commits target `main`; branch naming: `feature/*` or author-name tasks.
