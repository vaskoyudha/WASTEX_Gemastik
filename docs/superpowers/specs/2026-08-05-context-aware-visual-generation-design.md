# Context-Aware Sequential Image Generation

## Summary

Make WASTEX skill visuals (storyboard panels, before/after, mockup) reference the **actual scan photo** and the **previously generated panel**, instead of being text-prompt-only. This gives the image model visual context of the real waste item and step-to-step continuity, matching the sequential mechanism used in ChatGPT-style chat generation.

## Problem

- `generate_image` (backend/app/agent/tools/image_gen.py:63) sends only a text prompt to the wrong endpoint (chat/completions + `modalities`) — no image context at all.
- The skill has no link to the scan photo (`SkillCreateRequest` has no image/scan reference), so the model can never see the item it is illustrating.
- Panels are generated independently: no consistency between step N and step N-1, and no fidelity to the real object.

## Background research

- "On Error Propagation of Diffusion Models" (arXiv:2308.05021) — sequential diffusion chains accumulate cumulative error; later panels can drift from the true subject.
- Story2Board (arXiv:2508.09983) — combine a shared reference anchor with per-panel prompts; re-anchor the reference into every panel.
- ConsiStory (SIGGRAPH 2024, NVIDIA) — conditioning on prior output is the standard mechanism for consistency in a series.
- Production practice (FLUX Redux `downsampling_factor`, IP-Adapter weights) — reference strength is controllable: strong for the photo, weaker for style hints.
- 9Router image API (`POST /v1/images/generations`) supports reference images per provider:
  - `black-forest-labs` (FLUX) / `fal-ai` / `runwayml` / `nanobanana`: `image` (ref / img2img / edit mode)
  - `codex`: `image`, `images[]`, `image_detail`
- Decision (user, 2026-08-05): **sequential previous-reference is the core mechanism** (each panel references the previous panel's output for continuity), with the scan photo passed as a **secondary anchor** so long chains cannot drift away from the real object. Optional human refine mode is out of scope for this iteration.

## Design

### 1. Data model

**New column `skills.reference_image_path`** (text, nullable):
- Object path of the scan photo, e.g. `scans/{uuid}.jpg`
- Written at skill creation when the skill originates from a scan
- `NULL` for skills created without a scan (expert manual creation) → prompt-only generation

**New column `generated_visuals.reference_image_path`** (text, nullable):
- Audit trail of which reference image(s) fed a given panel (photo path, previous panel path, or both)
- Populated along with the existing `prompt` column

**Frontend:** skill-creator already has the scan (`ScanResult.scan_id`); the create-skill payload gains `reference_image_path` — backend resolves the scan row to its `image_url` object path. No public URL needed; storage is internal (same service account).

### 2. Image generation request (backend/app/agent/tools/image_gen.py)

Replace the chat/completions+modalities call with 9Router's real endpoint:

```
POST {openrouter_base_url}/images/generations?response_format=binary
Content-Type: application/json
Authorization: Bearer {openrouter_api_key}
{
  "model": settings.image_model,
  "prompt": <panel prompt text>,
  "size": "1024x1024",
  ...provider-specific reference fields
}
```

**Signature change:**
```python
async def generate_image(prompt: str, reference_images: list[bytes] | None = None) -> bytes
```

**Reference field mapping (per provider, resolved via `/v1/models/info?id=` capability flags at runtime):**
- Single-ref providers (`black-forest-labs`, `fal-ai`, `runwayml`, `nanobanana`): `"image": <base64 of primary ref>`
- Multi-ref providers (`codex`): `{"image": <base64>, "image_detail": "high"}` — primary ref only per call (multi-reference is a later iteration)
- The **previous panel is the primary reference** (continuity); the **scan photo is the secondary anchor** (keeps the real object true, per the user decision in Background research).

**Reference strength policy (prompt-level):** the panel prompt text states which reference is the truth vs the style hint, mirroring the Redux `downsampling_factor` philosophy:
- Primary (previous panel): "match the previous panel's item and style exactly for continuity"
- Secondary (scan photo): "keep the real object's shape, color and material consistent with this photo"

If the provider/model lacks reference support, or no reference images are available, fall back to prompt-only (current behavior).

### 3. Sequential threading (backend/app/api/visuals.py)

`generate_all_visuals` keeps its sequential loop but threads context:

```python
prev_output: bytes | None = None
for order in orders:
    refs = [photo_bytes]                # base anchor
    if prev_output is not None:
        refs.append(prev_output)        # continuity (secondary)
    panel = await _generate_visual(sb, skill, "storyboard", order, refs)
    prev_output = panel                 # feeds the next panel

before_after refs = [photo_bytes, last_available_panel]
mockup refs      = [photo_bytes, last_available_panel]
```

**Cache semantics:** if a panel is already cached (`generated_visuals` row exists), its stored image bytes are loaded and used as `prev_output` for the next panel — regenerated panels are never re-cached wrongly, and re-runs resume mid-chain.

Reference list is capped at the latest 3 images to bound request payload size on long skills.

### 4. Failure behavior

- A failed panel generation does **not** abort the batch. The loop continues; the next panel generates with `refs = [photo_bytes]` only (graceful degradation, no error cascade). This deviates from a hard "stop on failure" in favor of availability and matches the photo-anchor rationale: later panels stay true to the real object.
- Failures still swallow `ImageGenUnavailable` (as today) and are logged; cached visuals are always reused when present.

### 5. Config

- `image_model` default updated to a reference-capable model id available via `/v1/models/image` (evaluated against the proxy during implementation; fallback default `black-forest-labs/flux-*`-style id if present).
- No new settings keys required for this iteration (reference support is detected per-provider at runtime).

### 6. Testing

**Unit (mocked provider):**
- `test_generate_image_uses_generations_endpoint` — asserts POST to `/images/generations?response_format=binary`, not chat/completions; raw bytes returned.
- `test_generate_image_with_references` — reference bytes included in the request body per provider mapping.
- `test_generate_all_threads_previous_panel` — step 2's request contains step 1's output + photo; step 1 contains photo only.
- `test_generate_all_skips_cache_and_resumes` — cached panel bytes become `prev_output`; cached panel is not regenerated.
- `test_generate_all_continues_after_failure` — failed panel → next panel refs = [photo] only; batch completes.
- `test_prompt_only_when_no_reference_images` — NULL `reference_image_path` and/or no provider ref support → `generate_image(prompt, None)`.

**API:**
- create skill with `reference_image_path` → approve → `generated_visuals` rows carry `reference_image_path` populated; generation order step 1 → 2 → 3 → before_after → mockup.

**E2E (optional/manual):**
- Existing manual MD + photo bundle flow stays valid and unchanged (the app's prompt output is identical, now with an added photo-anchor note).

## Out of scope

- Interactive per-panel refine mode ("ChatGPT-style" human-in-the-loop editing)
- Multi-reference (`images[]`) calls to codex-style providers (single primary ref per call)
- Training-based consistency (LoRA/DreamBooth) — current capabilities of the proxy do not support training
- Video-model-based storyboard generation (DreamShot style)
