"""Bangun kit prompt image v3 untuk 4 skill plastik_pet (two-phase baru).

Alur:
1. Ambil 4 skill approved dari Supabase (pakai service key).
2. Ekstrak identity vision dari foto scan lokal (pet_bottle.jpg / voss_bottle.jpg)
   via kode app (extract_object_identity, model vision mimo).
3. Bangun semua prompt via builder image_gen.py (materials panel, storyboard per
   step + master + reference policy, before/after, mockup).
4. Tulis README-*.md format v3 per skill di visuals/manual-generation/.

Jalankan dari backend/: uv run python scripts/build_pet_kits.py
"""

import asyncio
import json
import os
from pathlib import Path

from app.agent.tools.image_gen import (
    build_before_after_prompt,
    build_master_prompt,
    build_materials_panel_prompt,
    build_mockup_prompt,
    build_storyboard_prompt,
)
from app.agent.tools.vision import extract_object_identity
from app.schemas import ObjectIdentity
from supabase import create_client

SKILL_IDS = [
    "88f3fa43-e918-4238-8dc9-4b09a7805e44",  # Tanaman Hidropot dari Botol PET (voss)
    "b0fe87c2-acfb-4ef1-b30c-78148329a0ba",  # Tempat Pensil dari Potongan Botol PET (pet)
    "26419394-50a7-4e54-ab7e-059289d18e56",  # Organizer Meja Multifungsi (pet)
    "04f70a21-e4d4-44c4-8611-631058199ae5",  # Organizer Modular Bening (pet)
]

PHOTO_FOR_SKILL = {
    "88f3fa43-e918-4238-8dc9-4b09a7805e44": "voss_bottle.jpg",
    "b0fe87c2-acfb-4ef1-b30c-78148329a0ba": "pet_bottle.jpg",
    "26419394-50a7-4e54-ab7e-059289d18e56": "pet_bottle.jpg",
    "04f70a21-e4d4-44c4-8611-631058199ae5": "pet_bottle.jpg",
}

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "visuals" / "manual-generation"
PHOTO_DIR = OUT


def _fence(prompt: str) -> str:
    return "```\n" + prompt + "\n```"


def _render_readme(
    skill: dict,
    identity_json: dict,
    photo: str,
    materials_prompt: str,
    steps_prompts: list[tuple[int, str]],
    ba_prompt: str,
    mock_prompt: str,
) -> str:
    title = skill["title"]
    n = len(skill["steps"])
    steps_rows = "\n".join(
        f"| {s['order']} | {s.get('instruction', '')} | {s.get('warning') or '—'} |"
        for s in sorted(skill["steps"], key=lambda x: x["order"])
    )
    tools = [t["name"] for t in skill.get("tools", []) if t.get("name")]
    uploads = "\n".join(
        f"**STEP {o}** — Upload: `panel-{o - 1}` + `{photo}`\n\n{_fence(p)}\n"
        for o, p in steps_prompts
    )
    # upload step pertama: panel-0 = hasil generate panel alat & bahan
    first = steps_prompts[0][1]
    rest = steps_prompts[1:]
    uploads = (
        f"**STEP 1** — Upload: `panel-0` (hasil STEP 0) + `{photo}`\n\n{_fence(first)}\n\n"
        + "\n".join(
            f"**STEP {o}** — Upload: `panel-{o - 1}` + `{photo}`\n\n{_fence(p)}\n" for o, p in rest
        )
    )
    return f"""# Manual Image-Gen Kit v3 — {title}
> **Cara pakai**: README ini meniru **persis alur aplikasi WASTEX** (`POST /scan` → identity extraction → `generate_ideas` + `expand_proposal` (kritik kontinuitas + auto-repair) → `POST /skills/verify` → eager visual generation) untuk kasus manual: Anda generate gambar sendiri di ChatGPT (web). Data skill di bawah diambil **langsung dari database** (status approved), identity diekstrak dari foto scan via 9Router — vision: **`oc/mimo-v2.5-free`** — pada 2026-08-06 — bukan contoh karangan.

> **Fitur prompt v3**: persona perajin ("perajin ulung... produk bernilai jual tinggi"), Bahasa Indonesia penuh, format terseksi, `visual_description` per step, identity card sebagai **KONDISI AWAL** (bukan hukum abadi), reference policy **prioritas: ikuti step bukan panel sebelumnya**, deteksi transformasi (kata kerja), **kondisi tampak kumulatif**, panel 0 Alat & Bahan, dan daftar alat/bahan yang disuntikkan per step.

> Referensi foto scan (upload ini ke ChatGPT): **`{photo}`**

---

## Bagian A — Alur Aplikasi (acuan)

```
1. POST /scan (foto)        → vision → {{material, condition, confidence}}          ✅ SUDAH DIJALANKAN
2. extract_object_identity  → vision → {{shape, colors, material, features}}        ✅ SUDAH DIJALANKAN
3. generate_ideas           → LLM buat 3 ide ringkas (SATU panggilan)                ✅ SUDAH DIJALANKAN
4. expand_proposal          → detail lengkap + kritik kontinuitas + auto-repair      ✅ SUDAH DIJALANKAN
5. POST /skills/verify      → validasi 4 aspek                                      ✅ layak
6. POST /skills (create)    → skill dibuat, status pending                          ✅ SUDAH DIJALANKAN (skill nyata)
7. Skill disetujui          → generate_all_visuals() SEQUENTIAL:
      panel 0 alat & bahan: refs = [PHOTO]
      storyboard step 1:    refs = [PANEL-0, PHOTO]
      storyboard step N:    refs = [PANEL-(N-1), PHOTO]
      before_after + mockup: refs = [PANEL-LAST, PHOTO]
```

**Aturan sequential (persis kode `generate_all_visuals`):**
- Panel Alat & Bahan digenerate dulu (anchor pertama), lalu step 1 dst.
- Di ChatGPT manual: mulai step 1, lampirkan **panel alat-bahan + scan photo**.
- Kegagalan satu step → `last_panel=None` → lanjut (foto scan tetap anchor).

---

## Bagian B — Input Scan (hasil nyata)

| Item | Nilai |
|---|---|
| File | `{photo}` |
| Material (label ID) | plastik_pet (botol PET) |
| **Object Identity** (kondisi awal) | `{json.dumps(identity_json, ensure_ascii=False)}` |

---

## Bagian C — Skill + Steps (hasil nyata dari database)

- **Title**: `{title}`
- **Difficulty**: {skill.get("difficulty")} / **est. cost**: Rp{skill.get("est_cost_idr") or 0} / **est. price**: Rp{skill.get("est_price_idr") or 0}
- **Tools**: {", ".join(tools) or "—"}
- **additional_materials**: {", ".join(f"{m['name']} ({m['category']}, Rp{m['est_cost_idr']})" for m in skill.get("additional_materials", [])) or "—"}

| Step | Instruksi | Warning |
|---|---|---|
{steps_rows}

> Skill id `{skill["id"]}`, status **approved** (ter-ingest ke RAG).

---

## Bagian D — PROMPT SEQUENTIAL v3 (siap tempel ke ChatGPT)

**Urutan**: generate satu per satu TANPA memulai chat baru. STEP 0 upload foto saja; step 1-N upload panel sebelumnya + foto.

**STEP 0 — PANEL ALAT & BAHAN** — Upload: `{photo}`

{_fence(materials_prompt)}

{uploads}
---

## Bagian E — Before/After + Mockup (refs: panel-{n}, scan photo)

**Before / After** — Upload: `panel-{n}` + `{photo}`

{_fence(ba_prompt)}

**Mockup** — Upload: `panel-{n}` + `{photo}`

{_fence(mock_prompt)}

---

## Bagian F — Prompt Verifikasi Panel (vision; QA manual opsional)

```text
# Tugas
Periksa panel ilustrasi tutorial yang digenerate (gambar dilampirkan).

## Yang diperiksa
1. Konsistensi objek: bahan & gaya SAMA dengan panel sebelumnya; warna/label boleh berubah bila aksi step mengubahnya.
2. Relevansi aksi: panel menggambarkan aksi step yang diminta (ikuti step, bukan panel sebelumnya).
3. Kualitas: tidak ada teks/huruf/watermark, gaya flat illustration pastel yang konsisten.

## Format Output (WAJIB)
Hanya JSON valid:
{{"verdict":"ok|needs_revision","issues":["<satu kalimat per masalah, kosong jika ok>"],"confidence":<0.0-1.0>}}
```

---

## Bagian G — Hasil Nyata

### G1. Object identity (vision, mimo)
```json
{json.dumps(identity_json, indent=2, ensure_ascii=False)}
```

> Semua prompt di Bagian D–E dihasilkan dari kode app (`build_master_prompt` + `build_storyboard_prompt` + `build_identity_block` + `build_materials_panel_prompt` + `build_before_after_prompt` + `build_mockup_prompt` di `backend/app/agent/tools/image_gen.py`) dengan data nyata dari database — bukan ditulis manual.
"""


async def main() -> None:
    s = {k: os.environ.get(k) for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY")}
    if not all(s.values()):
        raise SystemExit("SUPABASE_URL/SUPABASE_SERVICE_KEY tidak ada di env")
    sb = create_client(s["SUPABASE_URL"], s["SUPABASE_SERVICE_KEY"])
    rows = sb.table("skills").select("*").eq("status", "approved").execute().data
    skills = [r for r in rows if r["id"] in SKILL_IDS]
    if len(skills) != len(SKILL_IDS):
        raise SystemExit(f"skill tidak lengkap: {[r['id'] for r in skills]}")

    # identity vision per foto unik
    identities: dict[str, dict] = {}
    for photo in sorted(set(PHOTO_FOR_SKILL.values())):
        raw = (PHOTO_DIR / photo).read_bytes()
        identity = await extract_object_identity(raw)
        identities[photo] = identity.model_dump(mode="json")
        print(
            f"identity {photo}: {json.dumps(identity.model_dump(), ensure_ascii=False)}", flush=True
        )

    for skill in skills:
        sid = skill["id"]
        photo = PHOTO_FOR_SKILL[sid]
        identity_json = identities[photo]

        obj_identity = ObjectIdentity.model_validate(identity_json)
        mat_prompt = build_materials_panel_prompt(skill, obj_identity)
        steps_prompts = []
        for step in sorted(skill["steps"], key=lambda x: x["order"]):
            raw = build_storyboard_prompt(
                skill, step, identity=obj_identity, step_count=len(skill["steps"])
            )
            steps_prompts.append((step["order"], build_master_prompt(raw, has_references=True)))
        ba = build_before_after_prompt(skill)
        mock = build_mockup_prompt(skill)
        slug = {
            "88f3fa43-e918-4238-8dc9-4b09a7805e44": "hidropot",
            "b0fe87c2-acfb-4ef1-b30c-78148329a0ba": "pencil-case",
            "26419394-50a7-4e54-ab7e-059289d18e56": "organizer-desk",
            "04f70a21-e4d4-44c4-8611-631058199ae5": "organizer-modular",
        }[sid]
        md = _render_readme(skill, identity_json, photo, mat_prompt, steps_prompts, ba, mock)
        target = OUT / f"README-pet-{slug}.md"
        target.write_text(md, encoding="utf-8")
        print(f"wrote {target.relative_to(ROOT)} ({len(md)} chars)", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
