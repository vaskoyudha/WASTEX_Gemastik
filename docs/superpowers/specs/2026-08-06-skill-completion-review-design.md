# Design: Skill Completion Proof + Star Review (Foto Produk Jadi & Rating Kepopuleran)

Tanggal: 2026-08-06 · Status: Disetujui user (brainstorming) · Pendekatan: A (satu tabel `skill_completions`)

## Masalah

Alur saat ini terputus setelah user mengikuti langkah tutorial:

1. Tidak ada cara bagi user untuk menandai "saya sudah menyelesaikan skill ini"
   beserta **bukti foto produk jadi**.
2. Tidak ada **rating per-skill**. Yang ada hanya `feedback.rating` (terikat
   `agent_run_id`, menilai jawaban AI — bukan skill) dan `impact_events`
   (mencatat dampak, tanpa rating/foto).
3. User lain tidak bisa melihat **kepopuleran/kualitas** suatu skill (apakah
   skill itu terbukti bisa dibuat dan disukai).

## Tujuan (hasil brainstorming user)

1. **Verifikasi keberhasilan**: user meng-upload foto produk jadi sebagai bukti
   berhasil mengikuti skill.
2. **Rating bintang 1–5** per skill, terlihat oleh user lain sebagai sinyal
   kepopuleran.

## Keputusan desain (hasil brainstorming user)

| Aspek | Keputusan |
|---|---|
| Gate rating | Rating **hanya** bisa diberi setelah upload foto produk jadi |
| Validasi foto | Wajib upload, **tanpa** cek AI |
| Tampilan ke user lain | Bintang rata-rata + jumlah reviewer + galeri foto komunitas |
| Entry point | Tombol "Saya Sudah Selesai" di akhir tutorial |
| Model data | **Pendekatan A** — satu tabel `skill_completions` (completion + rating satu baris) |
| Scope | "Foto → design siap jual" **ditunda** (sudah ada jalur AI Selling Assistant) |

## Desain

### 1. Model data — migration baru `skill_completions`

```sql
create table if not exists skill_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  photo_path text not null,              -- path di storage bucket 'completions'
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (skill_id, user_id)             -- 1 completion per user per skill
);
create index if not exists skill_completions_skill_idx on skill_completions (skill_id);
alter table skill_completions enable row level security;

create policy "completions_public_read"  on skill_completions for select using (true);
create policy "completions_owner_insert" on skill_completions for insert with check (auth.uid() = user_id);
create policy "completions_owner_delete" on skill_completions for delete using (auth.uid() = user_id);
```

- `rating` NOT NULL → foto + rating dikumpul dalam satu alur (gate alami).
- `unique(skill_id, user_id)` → cegah spam; duplikat ditolak `409`.
- Popularitas = `AVG(rating)` + `COUNT(*)` per skill, dihitung saat read.
- **Storage:** bucket baru `completions` (public-read, authenticated-write ke path miliknya).

### 2. Backend API (router `skills.py`, prefix `/skills`)

#### 2a. `POST /skills/{skill_id}/complete` — submit foto + rating (auth wajib)
- Input: multipart `file` (gambar) + form `rating` (1–5) + `comment` (opsional).
- Validasi: tipe JPEG/PNG/HEIC + ≤10MB (pola `/scan`); `rating` 1–5 (Pydantic `Field(ge=1, le=5)`).
- Alur: upload foto ke `completions/{completion_id}.{ext}` → insert baris.
- Respons `201` + objek completion.
- Error: skill tak ada `404` · sudah complete `409` · bukan gambar `415` · terlalu besar `413` · rating invalid `422`.
- Urutan aman: upload foto dulu, baru insert DB.

#### 2b. `GET /skills/{skill_id}/completions` — popularitas + galeri (publik)
```json
{
  "skill_id": "...",
  "avg_rating": 4.3,
  "count": 12,
  "gallery": [
    { "photo_url": "https://.../completions/xxx.jpeg",
      "rating": 5, "comment": "Mudah diikuti!",
      "created_at": "...", "user_display_name": "Budi" }
  ]
}
```
- `avg_rating` = `AVG(rating)` dibulatkan 1 desimal; `gallery` urut `created_at desc`.
- Skill tak ada `404`. `user_display_name` via join `profiles` (opsional, boleh kosong dulu).

#### Skema Pydantic baru
`SkillCompletionCreate` (rating, comment) · `SkillCompletion` (per-baris) · `SkillCompletionsSummary` (avg_rating, count, gallery).

### 3. Frontend flow

#### 3a. Entry point
Tombol **"Saya Sudah Selesai 🎉"** di bawah "Lihat Before & After" pada `tutorial.tsx` → navigasi ke layar completion.

#### 3b. Layar completion baru — `app/product/[id]/complete.tsx`
1. Foto produk jadi — kamera/galeri (pakai ulang pola `upload.tsx` + `expo-image-picker`), preview.
2. Rating bintang 1–5 — komponen pemilih 5 bintang.
3. Komentar opsional — textarea pendek.
4. Tombol "Kirim Hasil" → `apiClient.completeSkill(skillId, foto, rating, comment)` → sukses = "Terima kasih! Hasil kamu kini tampil di galeri komunitas."

#### 3c. Menampilkan popularitas + galeri
- Detail produk (`index.tsx`): dekat judul tampil ⭐ `4.3` + "(12 review)"; seksi **"Hasil Komunitas"** (scroll horizontal foto produk jadi).
- *(opsional, phase 2)* badge ⭐ kecil di kartu skill pada `scan/hasil.tsx`.

#### Layer data
Tambah di `apiClient`: `completeSkill(...)` & `getSkillCompletions(skillId)`. Dipakai **langsung** (bukan lewat service Mock/API), karena `apiClient` selalu hit backend — tak perlu duplikasi mock.

### 4. Edge cases & error handling

| Kasus | Penanganan |
|---|---|
| Belum login | Tombol "Saya Sudah Selesai" → arahkan login dulu |
| Sudah pernah complete | Backend `409`; frontend tampilkan "Anda sudah mengirim hasil" + lihat galeri |
| Rating/foto belum dipilih | Tombol "Kirim" disabled sampai foto + rating terisi |
| 0 completion | Tampilkan "Belum ada review", bukan ⭐ 0 |
| Skill dihapus | `on delete cascade` → completion ikut terhapus |
| Upload foto gagal | Error "Coba lagi" (upload foto dulu, baru insert DB) |
| Backend down | Layar completion tampil error + tombol coba lagi |

### 5. Testing

**Backend** (pytest + FakeSupabase):
- `POST complete`: 201 happy path · 401 tanpa auth · 404 skill tak ada · 409 duplikat · 422 rating invalid · 415/413 file invalid
- `GET completions`: agregat benar (avg + count + gallery) · 404 skill tak ada · kosong → `count: 0`
- Migration ter-apply bersih

**Frontend** (Jest + mocked apiClient):
- Tutorial menampilkan tombol "Saya Sudah Selesai"
- Layar complete memanggil `completeSkill` dengan foto + rating
- Detail menampilkan rating + galeri
- Tombol kirim disabled sebelum foto + rating terisi

## Di luar scope (ditunda)

- Foto produk jadi → generate design/styling siap jual (sudah ada jalur AI Selling Assistant; bisa disambung belakangan).
- Validasi AI atas foto completion.
- Badge rating di kartu skill list (phase 2).

## File yang berubah

- `backend/supabase/migrations/20260806000003_skill_completions.sql` (baru)
- `backend/supabase/migrations/20260806000004_storage_completions.sql` (baru, bucket)
- `backend/app/api/skills.py` (endpoint complete + completions)
- `backend/app/schemas.py` (skema baru)
- `backend/tests/test_skill_completions.py` (baru)
- `src/services/api.ts` (completeSkill, getSkillCompletions)
- `app/product/[id]/complete.tsx` (baru)
- `app/product/[id]/tutorial.tsx` (tombol)
- `app/product/[id]/index.tsx` (rating + galeri)
- `app/product/[id]/complete.test.tsx`, update `tutorial`/`index` tests

> Catatan: nomor migration melanjutkan yang terakhir ada (`20260806000002_document_sources.sql`).
