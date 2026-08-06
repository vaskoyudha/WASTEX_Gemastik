# Spec — Auto-Approve Skill Ber-Verdict "Layak"

Tanggal: 2026-08-07 · Status: disetujui user (brainstorming)

## Ringkasan

Saat ini semua skill buatan user masuk status `pending` dan harus menunggu review manual expert sebelum tampil di katalog, masuk RAG, dan bisa dikerjakan orang lain. Ini membatasi kreativitas user dan menambah beban expert, padahal setiap draft sudah melewati verifikasi AI 4-aspek (kesesuaian material, kelayakan, keamanan, kelengkapan).

Fitur ini: skill dengan verdict AI **`layak`** langsung **auto-approved** saat dikirim — tampil di katalog, masuk RAG, dan visuals digenerate tanpa menunggu expert. Skill ber-verdict `perbaiki` tetap masuk antrian expert seperti sekarang. Expert dashboard dan sistem flag tetap berlaku sebagai safety net.

## Keputusan Desain (hasil brainstorming)

| Topik | Keputusan |
|---|---|
| Pembuat keputusan | Backend percaya `ai_verdict` dari frontend (tanpa re-verify LLM di server) |
| Verdict `perbaiki` | Tetap `pending`, expert yang review |
| Verdict `layak` | `approved` otomatis, `reviewed_by="ai-auto"` (audit trail) |
| Visuals | Langsung digenerate saat auto-approve (background task, sama dengan approval manual) |
| Safety net | Flag system ≥3 report → `needs_revision` tetap berlaku; expert tetap bisa ubah status via `PATCH /skills/{id}/status` (API). Menambah tombol tolak di tab "Disetujui" dashboard expert = follow-up terpisah, di luar scope spec ini |

## Alur

### Verdict "layak" (alur baru)

```
User pilih ide → POST /skills/proposals/expand (LLM)
  → POST /skills/verify (LLM) → verdict "layak"
  → POST /skills { ..., ai_verdict: "layak" }
  → backend: status=approved, reviewed_by="ai-auto"
  → background: ingest_skill (RAG) + generate_all_visuals
  → skill langsung tampil di GET /products (katalog)
```

### Verdict "perbaiki" atau tanpa verdict (tidak berubah)

```
  → POST /skills { ..., ai_verdict: null | "perbaiki" }
  → backend: status=pending
  → antrian expert dashboard
```

## Perubahan Komponen

### Backend

**`backend/app/schemas.py`** — tambah field di `SkillCreateRequest`:

```python
class SkillCreateRequest(SkillProposal):
    reference_scan_id: UUID | None = None
    ai_verdict: Literal["layak", "perbaiki"] | None = None
```

Nilai di luar itu ditolak Pydantic dengan 422 — tanpa kode tambahan.

**`backend/app/api/skills.py`** — `create_skill`:

- Terima parameter `background_tasks: BackgroundTasks`
- Kalau `body.ai_verdict == "layak"`:
  - `status = "approved"`, `reviewed_by = "ai-auto"`
  - Jadwalkan `background_tasks.add_task(ingest_skill, sb, skill_id)` dan `background_tasks.add_task(generate_all_visuals, sb, skill_id)` (pola identik dengan `update_status` di `skills.py:306-308`)
- Selain itu: `status = "pending"` seperti sekarang
- `ai_verdict` di-pop dari payload sebelum insert (bukan kolom DB — tidak perlu migration)

### Frontend

**`src/services/api.ts`** — `createSkill` terima `ai_verdict?: string | null` di samping `reference_scan_id`.

**`app/scan/skill-creator.tsx`** — `handleSubmit` kirim `ai_verdict: verdict?.verdict ?? null`; pesan layar selesai dibedakan:

- Verdict `layak` → "Skill terkirim dan langsung masuk katalog"
- Selain itu → "Skill terkirim, menunggu verifikasi expert"

## Yang Tidak Berubah

- Check duplikat 409 (judul + material + user sama)
- Flag system: ≥3 report → `needs_revision` (`skills.py:65`)
- Expert dashboard: tab "Menunggu" tetap berfungsi untuk skill `pending`; skill auto-approved muncul di tab "Disetujui" (read-only di UI saat ini — penolakan via API `PATCH /status`, tombol UI = follow-up)
- `PATCH /skills/{id}/status` manual untuk expert
- Validasi `ensure_uuid`, auth `get_current_user`

## Error Handling

| Kasus | Perilaku |
|---|---|
| `ai_verdict` nilai invalid | 422 Pydantic |
| `generate_all_visuals` gagal di background | Skill tetap approved & tampil di katalog; visuals menyusul (perilaku sama dengan approval manual saat ini) |
| User memanipulasi `ai_verdict="layak"` tanpa verify asli | Skill approved tapi terlindungi: flag ≥3 → `needs_revision`, expert bisa ubah status via API |
| Verdict null (verify gagal/tidak dijalankan) | `pending` — fallback ke alur expert |

## Testing

**Backend (`backend/tests/test_skill_creator_endpoints.py`):**

1. Create dengan `ai_verdict="layak"` → row tersimpan `status="approved"`, `reviewed_by="ai-auto"`
2. Create dengan `ai_verdict="perbaiki"` → `status="pending"`
3. Create tanpa `ai_verdict` → `status="pending"` (backward compatible)
4. Create dengan `ai_verdict="invalid"` → 422

**Frontend (`app/scan/skill-creator.test.tsx`):**

1. Submit dengan verdict `layak` mengirim `ai_verdict: "layak"` dan menampilkan pesan "langsung masuk katalog"
2. Submit dengan verdict `perbaiki` menampilkan pesan "menunggu verifikasi expert"
