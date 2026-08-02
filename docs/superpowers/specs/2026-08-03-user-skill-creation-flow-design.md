# User Skill Creation Flow — Design

**Date:** 2026-08-03
**Status:** Approved by user (sections 1-4)
**Related:** docs/superpowers/plans/2026-07-29-wastex-gap-closure.md, prd.md

## 1. Goal

Complete the skill lifecycle: after scanning waste, a logged-in user can create a NEW
upcycling skill from the AI-identified material. The AI proposes accurate skill ideas,
verifies user edits with interactive chatbot-style feedback, the skill is stored as
`pending`, an expert approves it from the in-app dashboard, and only then does it become
a retrievable, visualizable "verified skill".

This closes existing gaps: no `POST /skills` backend endpoint (frontend call gets 405),
expert dashboard is mock/local-only, and visuals are gated to `approved` skills.

## 2. User Flow (end-to-end)

```
Scan photo → hasil.tsx (existing AI vision analysis)
   │
   ├─ [New] "Buat Skill Baru dari Material Ini" → app/scan/skill-creator.tsx
   │    1. "Generate Ide" → POST /skills/proposals → 3 proposal skill
   │    2. User picks one → edits draft (title, description, steps, warnings, difficulty, estimates)
   │    3. Chatbot popup (bottom-sheet): POST /skills/verify each round with draft + chat history
   │       → AI verdict "layak" or "perbaiki" with structured feedback
   │    4. On "layak" → POST /skills → stored with status='pending', origin='user', created_by=JWT sub
   │
   ├─ [Existing] "Pengolahan Sampah" → rekomendasi produk (unchanged)
   └─ [New] "Skill Terverifikasi" → list of approved skills for this material (GET /skills)

Expert dashboard (app/expert-dashboard.tsx, rewired to real API)
   → GET /skills?status=pending → review → PATCH /skills/{id}/status
   → approved: background ingest (existing) → retrievable + visuals work (existing /visuals gate)

User sees own submissions in profil.tsx ("Skill Saya": menunggu/disetujui/ditolak)
```

## 3. Backend

### 3.1 New AI module — `backend/app/agent/tools/skill_proposals.py`

Same pattern as `vision.py`: system prompt + `response_format: json_object` +
Pydantic validation + retry/fallback model via `httpx` to OpenRouter.

- **`SKILL_PROPOSAL_PROMPT`** — accuracy-focused:
  - May only propose skills genuinely buildable from the given material (6 fixed materials).
  - Forbidden to introduce materials outside the list; if no good idea exists, return empty list.
  - Every step must have an instruction + safety warning.
  - Structured JSON output: title, description, difficulty (`pemula|menengah|mahir`),
    steps `[{order, instruction, warning}]`, tools, est_cost_idr, est_price_idr.
- **`SKILL_VERIFY_PROMPT`** — verifies an edited draft: (1) material match, (2) build
  feasibility, (3) safety, (4) step completeness. Output: `verdict: layak|perbaiki`,
  `feedback[]` (per point), `suggestions[]`.

### 3.2 Schemas (`backend/app/schemas.py`)

- `SkillProposal` — title, description, material, difficulty, steps[{order,instruction,warning}], tools[], est_cost_idr, est_price_idr
- `SkillVerifyRequest` — draft: SkillProposal, chat_history: list[dict]
- `SkillVerifyResponse` — verdict: Literal["layak","perbaiki"], feedback: list[str], suggestions: list[str]
- `SkillCreateRequest` — SkillProposal (created_by set server-side from JWT)

### 3.3 Endpoints (all require `get_current_user`)

| Endpoint | Function |
|---|---|
| `POST /skills/proposals` | body `{material, condition}` → 3 proposals from AI |
| `POST /skills/verify` | draft + chat history → feasibility feedback from AI |
| `POST /skills` | insert skill: `status='pending'`, `origin='user'`, `created_by` = JWT sub; 409 on exact duplicate (title+material, same user) |
| `GET /skills?mine=true` | user's own submissions (new param on existing list endpoint) |
| `PATCH /skills/{id}/status` | existing; dependency extended to accept expert JWT via new `require_expert` (checks `profiles.role`, default `user`); service-role still accepted |

### 3.4 Migration — `backend/supabase/migrations/20260803000001_user_skills.sql`

- `ALTER TABLE skills ADD COLUMN created_by uuid` (nullable, references auth.users)
- Extend `status` check constraint with `'pending'`
- Extend `origin` check constraint with `'user'`
- `CREATE INDEX skills_created_by_idx`
- `ALTER TABLE profiles ADD COLUMN role text not null default 'user'` (for `require_expert`)

### 3.5 RLS

No changes: writes stay service-role via backend (existing pattern); `created_by` comes
from the JWT at the server, never from the client.

## 4. Frontend

### 4.1 `app/scan/hasil.tsx`

- New button "Buat Skill Baru dari Material Ini" → `/scan/skill-creator`
- New section "Skill Terverifikasi": up to 3 approved skills for this material (GET /skills)
- "Pengolahan Sampah" = existing rekomendasi button, positioned as a processing option

### 4.2 `app/scan/skill-creator.tsx` (new)

1. **Ide stage:** POST /skills/proposals → 3 proposal cards (title, description, difficulty, estimate) + "Generate Ulang"
2. **Edit stage:** form for title, description, per-step instruction+warning, tools, estimates
3. **Verify stage:** "Verifikasi dengan AI" opens bottom-sheet chatbot popup; draft sent as a message each round; AI replies verdict + feedback; iterate until "layak"
4. **Submit stage:** enabled on "layak" → POST /skills → success state "menunggu review"

### 4.3 `app/expert-dashboard.tsx`

- Replace mock/local data with real API: GET /skills?status=pending; approve/reject via PATCH /skills/{id}/status
- Remove `initialItems` mock and `src/services/localState` usage from this screen

### 4.4 Services & types

- `src/services/api.ts`: `getSkillProposals`, `verifySkill`, `createSkill`, `getSkills({status, mine})`. Note: `request()` currently sends no `Authorization` header (only `deleteScan` passes a token explicitly) — new auth-required calls must attach the JWT from the auth service (stored via Supabase session) the same way.
- `src/services/types.ts`: `SkillProposal`, `SkillVerifyResponse`, skill status types

### 4.5 `app/(tabs)/profil.tsx`

- "Skill Saya" list: own submissions with status badges via GET /skills?mine=true

## 5. Error Handling, Security & Testing

### 5.1 Backend errors

- AI failure/timeout: retry once per model + fallback model (existing scan pattern), then 503 `{"detail": "AI unavailable"}`
- Invalid JSON/schema from AI: one re-prompt retry, then 503; never persist unvalidated data
- Empty proposal list: frontend empty state "Belum ada ide layak untuk material ini"
- Duplicate skill: 409 (same title + material + creator)

### 5.2 Security

- `created_by` set server-side from JWT (no client spoofing)
- `require_expert` rejects non-expert JWTs (403); service-role path preserved
- No service key in the app

### 5.3 Testing

- **Backend pytest:** prompt builder unit tests (material constraint, 4 verify aspects); POST /skills (auth, 409, pending insert); proposals/verify with mocked provider (pattern: test_vision_prompt.py); require_expert (403/200); migration checks
- **Frontend jest:** skill-creator (proposals load, edit, chatbot → layak enables submit), expert-dashboard (pending from API, approve/reject calls PATCH), hasil (new button/section renders)
- **Optional E2E:** extend eval/smoke_e2e.py with create-skill → verify → list
