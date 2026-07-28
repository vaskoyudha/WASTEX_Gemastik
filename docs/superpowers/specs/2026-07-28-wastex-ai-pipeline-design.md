# WASTEX AI Pipeline — Design Spec

Date: 2026-07-28
Status: Approved design, pending implementation plan
Scope: Full AI pipeline — Vision integration, Multimodal-RAG, grounded generation, Self-Expanding Skill Library with expert verification. No mobile app, no image generation (later sprints).

## 1. Goal

Implement the backend AI pipeline described in the WASTEX Gemastik proposal: a FastAPI service where an AI Upcycling Agent orchestrates material identification (Vision), hybrid retrieval over a verified skill knowledge base (Supabase pgvector), grounded generation (DeepSeek), and an expert-gated self-expanding skill discovery loop.

Success criteria:
- `/recommend` returns a grounded `SolutionPackage` for a waste photo, citing only approved skills.
- All 4 safety/quality gates enforced and logged.
- RAGAS evaluation runnable against a golden dataset (targets: faithfulness ≥90%, context precision ≥85%, context recall ≥80%, answer relevancy ≥80%).
- Discovered skills are unreachable by retrieval until expert-approved.

## 2. Architecture

Single FastAPI service (Railway) + Supabase (Postgres/pgvector/Storage). Agent layer built with Pydantic AI; LLM + Vision via OpenRouter; embeddings + reranking via DeepInfra.

```
app/
├── api/                      # HTTP layer
│   ├── scan.py               # POST /scan          photo → material identification
│   ├── recommend.py          # POST /recommend     material+intent → SolutionPackage
│   ├── skills.py             # GET /skills, PATCH /skills/{id}/status (expert, service-role auth)
│   └── ingest.py             # POST /ingest        admin-only seed indexing
├── agent/
│   ├── orchestrator.py       # AI Upcycling Agent (DeepSeek V3 via OpenRouter)
│   └── tools/
│       ├── vision.py         # scan_material: GPT-4o → Gemini fallback, structured JSON
│       ├── retrieval.py      # search_skills: calls SQL hybrid_search()
│       └── discovery.py      # discover_skill: drafts candidate, background task
├── rag/
│   ├── embeddings.py         # BGE-m3 (1024-dim) via DeepInfra API
│   ├── reranker.py           # bge-reranker-v2-m3 via DeepInfra API
│   ├── chunking.py           # 500–1000 tokens, 15% overlap, metadata tags
│   ├── ingest.py             # chunk + embed approved skills only
│   └── bootstrap.py          # seed skill drafting from sources.yaml
├── db/migrations/            # SQL: tables, hybrid_search(), HNSW + GIN indexes, RLS
├── eval/
│   ├── golden.jsonl          # ground-truth Q&A (30 → 100+)
│   └── run_ragas.py          # per-sprint RAGAS run, JSON results committed
└── sources.yaml              # curated source whitelist for bootstrap + discovery
```

Decisions:
- All chat/vision model calls through OpenRouter (one key, provider fallback). Embeddings/rerank through DeepInfra (OpenRouter does not serve them well).
- Hybrid retrieval is one Postgres function `hybrid_search(query_embedding, query_text, material_filter)`: pgvector cosine + Postgres FTS (`indonesian` config), fused with Reciprocal Rank Fusion in SQL. Named "lexical search" in docs — not BM25.
- No separate candidate table: skill status lifecycle lives in `skills.status`.
- Safety guarantee is structural: only `status='approved'` skills are ever chunked/embedded, so drafts are physically absent from the retrieval index.

## 3. Data Model (Supabase)

```sql
skills
  id uuid pk, title text,
  material text,          -- plastik_pet | plastik_hdpe | kardus | kaleng | kaca | sachet
  difficulty text,        -- pemula | menengah | mahir
  tools jsonb,            -- [{name, optional}]
  steps jsonb,            -- [{order, instruction, warning?}]
  risks jsonb,            -- [{hazard, mitigation}]
  est_cost_idr int, est_price_idr int,
  sources jsonb,          -- [{url|citation, accessed_at}]
  status text,            -- draft | approved | rejected | needs_revision
  origin text,            -- seed | discovered
  reviewed_by text null, created_at, updated_at

skill_chunks
  id uuid pk, skill_id uuid fk,
  content text,
  embedding vector(1024),         -- BGE-m3
  fts tsvector generated,         -- indonesian config
  metadata jsonb                  -- {material, difficulty, section}

scans
  id, user_id, image_url, material, condition, confidence, raw_json, created_at

agent_runs
  id, scan_id, query, retrieved_chunk_ids, gate_path jsonb, answer, latency_ms, created_at
```

Indexes: HNSW on `skill_chunks.embedding`, GIN on `skill_chunks.fts`.
RLS: users read own `scans`; `skills` readable by all; writes/status changes restricted to service role.
`agent_runs.gate_path` records fired gates, e.g. `["vision_ok","gap_detected","safety_failed","fallback"]` — feeds monitoring and evaluation.

## 4. Runtime Flow & Gates

`POST /recommend`:
1. **Vision**: `scan_material(image)` → `{material, condition, confidence}` (Pydantic-validated structured output).
   **Gate 1**: `confidence < 0.70` → return `needs_manual_verification` + the 6 material options; user selects manually, flow continues.
2. **Query build**: `query = f(material, condition, user_intent)`.
3. **Retrieval**: `hybrid_search(...)` → top 20 by RRF → rerank (bge-reranker-v2-m3) → top 5.
   **Gate 2**: best rerank score < 0.4 OR zero results → knowledge gap: fire `discover_skill` background task; respond to current user with `generic_safe_procedure(material)` (hardcoded, expert-reviewed templates per material).
4. **Generation**: DeepSeek with grounding prompt — answer only from provided context; if absent say "tidak tersedia"; cite `[skill_id]`. Output: `SolutionPackage {recommendation, steps, tools, risks, est_cost, est_price, marketing_copy, sources}`.
5. **Log** `agent_run` with `gate_path`.

Discovery path (background):
1. LLM drafts a candidate skill only from `sources.yaml` whitelist passed in-prompt (no live web search this phase).
2. Automated safety check: second LLM call with a safety rubric (banned: melting PVC, glass cutting for beginners, open flame near aerosols, ...).
   **Gate 3**: fail → `status='rejected'`, logged, never surfaces.
3. Pass → insert `skills` row `status='draft'`, `origin='discovered'`.
4. Expert PATCHes status to `approved` → `ingest.py` chunks + embeds it.
   **Gate 4**: only then does it become retrievable.

The requesting user is never blocked by verification latency — they always receive either a grounded answer or the generic safe procedure; verified discoveries benefit future users.

## 5. Error Handling

- Every external call (OpenRouter, DeepInfra): timeout + 1 retry + provider fallback (GPT-4o → Gemini for vision).
- Total provider failure → explicit error response; never a degraded/hallucinated answer.
- All LLM outputs validated as Pydantic models; parse failure → retry with error feedback (native Pydantic AI behavior).

## 6. Seed Bootstrap (KB is currently empty)

1. Team curates ~20–30 vetted sources into `sources.yaml` (bank sampah guides, K3 documents, academic upcycling references).
2. `bootstrap.py`: for each (material × difficulty) cell, LLM drafts skills in the `skills` schema citing only those sources → inserted as `status='draft'`, `origin='seed'`.
3. Human pass: team reviews in Supabase Table Editor, fixes and approves → target 50–100 approved seed skills initially (path to 200–500 later).
4. `ingest.py` chunks + embeds approved skills into `skill_chunks`.

## 7. Evaluation & Testing

- `eval/golden.jsonl`: 30 ground-truth Q&A pairs initially (grow to 100+): factual, multi-hop, adversarial (e.g., "bolehkah membakar sachet?" must refuse/warn).
- `eval/run_ragas.py`: RAGAS metrics per sprint; results committed as JSON. Targets per proposal.
- Vision mini-benchmark: 60 images (10 per class) before the full 600-image set.
- Unit tests: chunking, `hybrid_search` SQL (pytest against local Postgres), Pydantic schemas.
- Integration tests: each gate forced via mocked model responses — 4 gates × pass/fail matrix.
- E2E smoke: 1 real photo per material through `/recommend` on staging.

## 8. Deployment & Secrets

- Railway (FastAPI); Supabase migrations in `db/migrations/`.
- Secrets: `OPENROUTER_API_KEY`, `DEEPINFRA_API_KEY`, `SUPABASE_SERVICE_KEY`.

## 9. Out of Scope (this phase)

- Mobile app (React Native) and any UI, including the expert dashboard — expert review happens via Supabase Table Editor / PATCH endpoint.
- Image generation (tutorial storyboards, mockups).
- Live web search in skill discovery.
- Impact Tracker, pricing market-data integration, community flagging.

## 10. Prerequisites & Open Items

Structural:
- Decide backend location: separate repo vs monorepo subdir. Note: the spec's `app/` tree collides with the existing Expo `app/` directory in WASTEX_Gemastik.
- Python scaffolding unspecified: Python version, dependency manager (uv/poetry/requirements.txt), Dockerfile/start command for Railway.
- Migration tooling unnamed for `db/migrations/` (Supabase CLI vs Alembic vs raw psql).

Secrets & auth:
- Add `SUPABASE_URL` and `DATABASE_URL` to the secrets list (§8).
- User auth undefined: `scans.user_id` + RLS implies Supabase Auth, but the spec does not say how FastAPI verifies user JWTs.
- Expert auth gap: "service-role auth" on `PATCH /skills/{id}/status` implies sharing the service key with experts. Define a per-expert mechanism (JWT role/claim) instead.

Data flow:
- Image upload path missing for `/scan`: Supabase Storage bucket, size limits, and how images reach OpenRouter vision (signed URL vs base64).
- Blocking human prerequisites need owners/timeline: `sources.yaml` curation, 50–100 seed skill approvals, 30 golden Q&A pairs, 60 benchmark images. Everything downstream gates on these.

Eval & infra:
- RAGAS requires its own judge LLM + embeddings config (defaults to OpenAI); must be pointed at OpenRouter/DeepInfra — extra cost/config.
- Local test Postgres for pytest needs pgvector (docker-compose with a pgvector image).
- Background task durability: FastAPI `BackgroundTasks` loses `discover_skill` jobs on Railway restart/redeploy — accepted tradeoff for this phase, revisit if discovery volume grows.
- No CI pipeline defined to run the test suites.

Minor:
- Verify Supabase Postgres exposes the `indonesian` FTS config (shipped since PG13; likely fine).
