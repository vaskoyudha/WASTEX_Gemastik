# Auto-Approve Skill "Layak" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skill dengan verdict AI `layak` langsung auto-approved saat dikirim (masuk katalog + RAG + visuals) tanpa menunggu expert; verdict lain tetap `pending`.

**Architecture:** Frontend menyertakan `ai_verdict` hasil verify AI di body `POST /skills`. Backend percaya nilainya: `"layak"` → `status="approved"` + `reviewed_by="ai-auto"` + background `ingest_skill` & `generate_all_visuals` (pola identik `update_status` di `skills.py:290-309`); selain itu → `pending` seperti sekarang. Tidak ada migration DB (`reviewed_by` sudah ada).

**Tech Stack:** Python/FastAPI + Pydantic v2 (backend), React Native/Expo + TypeScript (frontend), pytest + FastAPI TestClient, Jest + React Testing Library.

## Global Constraints

- TIDAK menambah dependensi baru di kedua sisi.
- Commit message conventional (`feat(skills): ...`, `test(skills): ...`) + scope.
- UI copy dalam Bahasa Indonesia, mengikuti gaya yang sudah ada di `skill-creator.tsx`.
- TDD: test dulu, pastikan gagal, implementasi minimal, pastikan lulus, commit.
- Backend test: `uv run pytest backend/tests/test_skill_creator_endpoints.py backend/tests/test_skill_creator_schemas.py -v` (dari root repo).
- Frontend test: `npx jest app/scan/skill-creator.test.tsx src/services/__tests__/api.test.ts` (dari root repo).
- Typecheck akhir: `npx tsc --noEmit`.

---

### Task 1: Backend schema — field `ai_verdict` di SkillCreateRequest

**Files:**
- Modify: `backend/app/schemas.py` (class `SkillCreateRequest`, line ~290)
- Test: `backend/tests/test_skill_creator_schemas.py`

**Interfaces:**
- Produces: `SkillCreateRequest.ai_verdict: Literal["layak", "perbaiki"] | None` (default `None`) — dipakai Task 2 di `create_skill`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `backend/tests/test_skill_creator_schemas.py`:

```python
def test_skill_create_request_accepts_layak_verdict():
    req = SkillCreateRequest.model_validate({**VALID, "ai_verdict": "layak"})
    assert req.ai_verdict == "layak"


def test_skill_create_request_ai_verdict_defaults_none():
    req = SkillCreateRequest.model_validate(VALID)
    assert req.ai_verdict is None


def test_skill_create_request_rejects_invalid_verdict():
    with pytest.raises(ValidationError):
        SkillCreateRequest.model_validate({**VALID, "ai_verdict": "maybe"})
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `uv run pytest backend/tests/test_skill_creator_schemas.py -v -k ai_verdict`
Expected: FAIL — `AttributeError: 'SkillCreateRequest' object has no attribute 'ai_verdict'`

- [ ] **Step 3: Implementasi minimal**

Di `backend/app/schemas.py`, ubah `SkillCreateRequest` menjadi:

```python
class SkillCreateRequest(SkillProposal):
    reference_scan_id: UUID | None = None
    ai_verdict: Literal["layak", "perbaiki"] | None = None
```

(`Literal` sudah diimpor di baris 3 file tersebut.)

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `uv run pytest backend/tests/test_skill_creator_schemas.py -v`
Expected: semua PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_skill_creator_schemas.py
git commit -m "feat(skills): add ai_verdict field to SkillCreateRequest"
```

---

### Task 2: Backend endpoint — auto-approve di create_skill

**Files:**
- Modify: `backend/app/api/skills.py` (fungsi `create_skill`, line 124-176)
- Test: `backend/tests/test_skill_creator_endpoints.py`

**Interfaces:**
- Consumes: `SkillCreateRequest.ai_verdict` dari Task 1; `ingest_skill` dan `generate_all_visuals` (sudah diimpor di `skills.py:12,16`).
- Produces: `POST /skills` dengan `ai_verdict="layak"` menyimpan row `status="approved"`, `reviewed_by="ai-auto"`, dan menjadwalkan background ingest+visuals dengan signature `(sb, skill_id)`.

**Catatan penting untuk test:** FastAPI `TestClient` menjalankan `BackgroundTasks` secara sinkron sebelum response dikembalikan, jadi `ingest_skill`/`generate_all_visuals` ASLI akan terpanggil kalau tidak di-monkeypatch. Selalu monkeypatch keduanya di test auto-approve.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di akhir `backend/tests/test_skill_creator_endpoints.py`:

```python
def test_create_skill_layak_auto_approves_and_schedules_background(monkeypatch, fake_sb):
    calls = []

    async def fake_ingest(sb, skill_id):
        calls.append(("ingest", skill_id))

    async def fake_visuals(sb, skill_id):
        calls.append(("visuals", skill_id))

    monkeypatch.setattr("app.api.skills.ingest_skill", fake_ingest)
    monkeypatch.setattr("app.api.skills.generate_all_visuals", fake_visuals)

    r = TestClient(app).post(
        "/skills", json={**PROPOSAL, "ai_verdict": "layak"}, headers=_auth("u1")
    )
    assert r.status_code == 201
    row = fake_sb.table("skills").inserted[0]
    assert row["status"] == "approved"
    assert row["reviewed_by"] == "ai-auto"
    skill_id = row["id"]
    assert ("ingest", skill_id) in calls
    assert ("visuals", skill_id) in calls


def test_create_skill_perbaiki_stays_pending(monkeypatch, fake_sb):
    async def fail_if_called(*a, **k):
        raise AssertionError("background task tidak boleh dijadwalkan untuk perbaiki")

    monkeypatch.setattr("app.api.skills.ingest_skill", fail_if_called)
    monkeypatch.setattr("app.api.skills.generate_all_visuals", fail_if_called)

    r = TestClient(app).post(
        "/skills", json={**PROPOSAL, "ai_verdict": "perbaiki"}, headers=_auth("u1")
    )
    assert r.status_code == 201
    row = fake_sb.table("skills").inserted[0]
    assert row["status"] == "pending"
    assert "reviewed_by" not in row


def test_create_skill_invalid_verdict_422(fake_sb):
    r = TestClient(app).post(
        "/skills", json={**PROPOSAL, "ai_verdict": "maybe"}, headers=_auth("u1")
    )
    assert r.status_code == 422
```

Test existing `test_create_skill_inserts_pending` sudah meng-cover kasus tanpa `ai_verdict` (backward compat) — jangan diubah.

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `uv run pytest backend/tests/test_skill_creator_endpoints.py -v -k "layak or perbaiki or invalid_verdict"`
Expected: FAIL — status masih `pending`, `reviewed_by` tidak ada

- [ ] **Step 3: Implementasi minimal**

Di `backend/app/api/skills.py`, ubah signature `create_skill` menjadi (tambah `background_tasks`):

```python
@router.post("", status_code=201)
def create_skill(
    body: SkillCreateRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
    sb: Client = Depends(get_supabase),
) -> dict:
```

Lalu ubah bagian setelah dup-check (ganti blok `payload = ...` sampai `return res.data[0]`):

```python
    payload = body.model_dump(mode="json")
    payload.pop("reference_scan_id", None)
    ai_verdict = payload.pop("ai_verdict", None)
    payload["additional_materials_cost_idr"] = sum(
        m.est_cost_idr for m in body.additional_materials
    )
    payload.update(
        {
            "status": "approved" if ai_verdict == "layak" else "pending",
            "origin": "user",
            "created_by": user["user_id"],
            "reference_image_path": reference_image_path,
        }
    )
    if ai_verdict == "layak":
        payload["reviewed_by"] = "ai-auto"
    res = sb.table("skills").insert(payload).execute()
    if payload["status"] == "approved":
        skill_id = res.data[0]["id"]
        background_tasks.add_task(ingest_skill, sb, skill_id)
        background_tasks.add_task(generate_all_visuals, sb, skill_id)
    return res.data[0]
```

(`BackgroundTasks` sudah diimpor di `skills.py:4`; `ingest_skill` di `skills.py:16`; `generate_all_visuals` di `skills.py:12`.)

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `uv run pytest backend/tests/test_skill_creator_endpoints.py backend/tests/test_skill_creator_schemas.py -v`
Expected: semua PASS (termasuk test existing `test_create_skill_inserts_pending`)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/skills.py backend/tests/test_skill_creator_endpoints.py
git commit -m "feat(skills): auto-approve layak verdict on create"
```

---

### Task 3: Frontend API client — createSkill kirim ai_verdict

**Files:**
- Modify: `src/services/api.ts` (method `createSkill`, line 111-113)
- Test: `src/services/__tests__/api.test.ts`

**Interfaces:**
- Consumes: tidak ada (perubahan signature saja).
- Produces: `apiClient.createSkill(data: SkillProposal & { reference_scan_id?: string; ai_verdict?: string | null })` — dipakai Task 4.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di describe `'apiClient skill methods'` di `src/services/__tests__/api.test.ts` (setelah test `'createSkill posts to /skills'`):

```typescript
  it('createSkill sends ai_verdict in body', async () => {
    await apiClient.createSkill({ ...proposal, ai_verdict: 'layak' });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).ai_verdict).toBe('layak');
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx jest src/services/__tests__/api.test.ts -t "ai_verdict"`
Expected: FAIL — TypeScript error: `ai_verdict` tidak ada di tipe parameter `createSkill`

- [ ] **Step 3: Implementasi minimal**

Di `src/services/api.ts`, ubah signature `createSkill`:

```typescript
  async createSkill(data: SkillProposal & { reference_scan_id?: string; ai_verdict?: string | null }) {
    return request('/skills', { method: 'POST', body: data, headers: await authHeaders() });
  },
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx jest src/services/__tests__/api.test.ts`
Expected: semua PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/api.ts src/services/__tests__/api.test.ts
git commit -m "feat(api): createSkill accepts ai_verdict"
```

---

### Task 4: Frontend skill-creator — kirim verdict + pesan selesai dibedakan

**Files:**
- Modify: `app/scan/skill-creator.tsx` (`handleSubmit` line 86-97; EmptyState `stage === 'done'` line 246-253)
- Test: `app/scan/skill-creator.test.tsx`

**Interfaces:**
- Consumes: `apiClient.createSkill({ ..., ai_verdict?: string | null })` dari Task 3; state `verdict` (`SkillVerifyResponse | null`) yang sudah ada di komponen.
- Produces: submit menyertakan `ai_verdict: verdict?.verdict ?? null`; layar selesai menampilkan pesan berbeda per verdict.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan di describe `'SkillCreatorScreen verify + submit'` di `app/scan/skill-creator.test.tsx`:

```typescript
  it('submit sends ai_verdict layak and shows instant-catalog message', async () => {
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Skill layak dikirim');
    fireEvent.press(await findByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ai_verdict: 'layak' }),
    );
    expect(await findByText(/langsung masuk katalog/i)).toBeTruthy();
  });

  it('submit with perbaiki verdict shows expert-review message', async () => {
    mockVerify.mockResolvedValue({
      verdict: 'perbaiki',
      feedback: ['Bahan X tidak terdaftar.'],
      suggestions: [],
    });
    const { findByText } = await render(<SkillCreatorScreen />);
    fireEvent.press(await findByText('Pot Gantung PET'));
    await findByText('Kirim draft untuk review expert');
    fireEvent.press(await findByText('Kirim Skill untuk Verifikasi'));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ai_verdict: 'perbaiki' }),
    );
    expect(await findByText(/menunggu verifikasi expert/i)).toBeTruthy();
  });
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `npx jest app/scan/skill-creator.test.tsx -t "ai_verdict"`
Expected: FAIL — `mockCreate` dipanggil tanpa `ai_verdict` / pesan katalog tidak ada

- [ ] **Step 3: Implementasi minimal**

Di `app/scan/skill-creator.tsx`, ubah `handleSubmit`:

```typescript
  const handleSubmit = async () => {
    if (!draft || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.createSkill({
        ...draft,
        reference_scan_id: scanResult?.scan_id,
        ai_verdict: verdict?.verdict ?? null,
      });
      setStage('done');
    } catch {
      Alert.alert('Gagal Kirim', 'Skill belum bisa dikirim. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };
```

Dan ubah EmptyState `stage === 'done'`:

```tsx
        {stage === 'done' && (
          <EmptyState
            title="Skill Terkirim"
            description={
              verdict?.verdict === 'layak'
                ? 'Skill kamu langsung masuk katalog dan bisa dikerjakan semua orang.'
                : 'Skill kamu sekarang menunggu verifikasi expert.'
            }
            actionLabel="Lihat Hasil Scan"
            onAction={() => router.replace('/scan/hasil')}
          />
        )}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `npx jest app/scan/skill-creator.test.tsx`
Expected: semua PASS (10 test: 8 lama + 2 baru)

- [ ] **Step 5: Commit**

```bash
git add app/scan/skill-creator.tsx app/scan/skill-creator.test.tsx
git commit -m "feat(skill-creator): send ai_verdict on submit and differentiate done message"
```

---

### Task 5: Verifikasi akhir menyeluruh

**Files:** tidak ada perubahan — hanya verifikasi.

- [ ] **Step 1: Jalankan seluruh backend test suite**

Run: `uv run pytest backend/tests -v 2>&1 | tail -5`
Expected: semua PASS, tidak ada regresi

- [ ] **Step 2: Typecheck frontend**

Run: `npx tsc --noEmit`
Expected: exit code 0, tanpa error

- [ ] **Step 3: Smoke test E2E opsional (butuh backend live + Supabase live)**

Run: `cd backend && uv run python eval/smoke_e2e.py`
Expected: semua PASS (lewati step ini kalau backend/Supabase tidak live)

- [ ] **Step 4: Verifikasi manual di browser**

Alur: scan → Buat Skill Baru → pilih ide → tunggu verify →
- Kalau verdict 'layak': klik Kirim → layar selesai menampilkan "langsung masuk katalog" → cek `GET /products` memuat skill baru.
- Cek log backend `/tmp/opencode/uvicorn_newkey.log`: `POST /skills → 201`.

- [ ] **Step 5: Commit bila ada fix minor** (skip jika tidak ada perubahan)

```bash
git add -A && git commit -m "fix(skills): <deskripsi>"
```
