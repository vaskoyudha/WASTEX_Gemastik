# WASTEX — Mobile App Design Specification

**Sumber:** `WhatsApp Image 2026-07-19 at 19.30.26.jpeg`
**Judul:** WASTEX – Mobile App Flow (User Journey)
**Tagline:** Dari Sampah → Menjadi Produk Bernilai → Siap Dijual

---

## 1. Design System

### Warna

| Token | Warna | Penggunaan |
|---|---|---|
| Primary / Brand | `#16A34A` (emerald green) | Tombol utama, ikon aktif, badge "Mudah"/"Aman", highlight angka |
| Brand Dark | `#15803D` | Teks pada tombol sekunder, aksen teks hijau |
| Brand Light | `#DCFCE7` / `#F0FDF4` | Background chip, kartu highlight (harga, tips) |
| Background | `#FFFFFF` + `#F8FAFC` (slate-50) | Latar layar |
| Teks Utama | `#0F172A` (slate-900) | Judul, angka penting |
| Teks Sekunder | `#64748B` (slate-500) | Subtitle, label, deskripsi |
| Warning (Sedang) | Amber/orange | Badge "Sedang" |
| Danger | Red | Risiko, tombol tolak |

### Tipografi

- **Judul hero / angka besar:** Bold/ExtraBold, hitam pekat (`slate-900`)
- **Judul layar (header):** Semi-bold/Bold, ~16–17px, rata tengah
- **Body / subtitle:** Regular, `slate-500`, 12–14px
- **Label kecil / caption:** 10–12px, `slate-400`–`slate-500`
- **Badge:** teks kecil bold di dalam pill rounded-full

### Komponen Umum

- **Header layar dalam:** tombol back (chevron kiri) + judul rata tengah; layar detail produk punya ikon heart + share di kanan.
- **Tombol utama:** hijau penuh (`bg-brand`), rounded-2xl, teks putih bold, sering dengan ikon di kiri.
- **Tombol sekunder:** putih dengan border slate-200, teks `brand-dark`.
- **Kartu:** putih, rounded-2xl, border `slate-100` tipis, shadow sangat halus.
- **Badge kesulitan:** pill kecil — Mudah (hijau), Sedang (amber), Sulit (ungu/merah).
- **Bottom Navigation (5 item):** Beranda (home), Explorasi (search), **Scan (kamera, lingkaran hijau besar menonjol di tengah)**, Dampak (heart/leaf), Profil (user). Item aktif berwarna hijau.

---

## 2. Screen-by-Screen Specification

### Screen 1 — Landing Page (`app/(tabs)/index.tsx`)

- **Header:** logo WASTEX (ikon recycle hijau + teks "WASTEX") kiri; ikon lonceng kanan.
- **Hero:**
  - Judul besar bold 4 baris: "Ubah Sampah Menjadi Produk Bernilai Jual".
  - Subtitle: "Platform AI Upcycling dengan panduan visual, estimasi harga, dan tips jual untuk semua orang."
  - Dua tombol: hijau **Scan Sampah** (ikon kamera) dan outline putih **Upload Foto**.
  - Ilustrasi tempat sampah hijau berisi botol & tanaman di sisi kanan.
- **Bagaimana Cara Kerja?** — 3 langkah horizontal dengan panah antar langkah:
  1. Upload Sampah
  2. AI Analisis & Rekomendasi
  3. Buat & Jual Produk
- **Statistik (3 kolom):** `12.8 ton` Sampah Diolah · `3.245` Produk Dibuat · `Rp 128 jt` Nilai Ekonomi.

### Screen 2 — Upload Waste (`app/scan/upload.tsx`)

- Header: back + "Upload Sampah".
- Subtitle: "Ambil atau unggah foto sampah anorganik yang ingin kamu olah."
- **Dropzone:** kotak dashed-border dengan ikon cloud-upload besar, teks "Drag & Drop foto di sini", lalu "atau".
- Tombol hijau **Ambil Foto** (ikon kamera) + tombol putih **Pilih dari Galeri**.
- **Material yang didukung:** deretan ikon kecil — Plastik, Kaleng, Kaca, Sachet, Dll.
- **Kartu tips** (hijau muda): "Tips foto terbaik — Pastikan objek terlihat jelas, tidak blur, dan pencahayaan cukup."

### Screen 3 — AI Material Detection (`app/scan/hasil.tsx`)

- Header: back + "Hasil Analisis AI".
- **Preview foto** besar rounded, dengan tombol overlay "Edit Foto" (kanan bawah, gelap).
- **Jenis Material:** label kiri; kanan `96%` hijau besar + caption "Tingkat Keyakinan".
- Nama material besar bold: "Botol Plastik PET".
- **Baris detail** (ikon + label kiri, nilai kanan):
  - Kondisi → Baik
  - Tingkat Kesulitan → Mudah
  - Potensi Nilai → Sedang
  - Risiko Pengolahan → badge hijau "Aman"
- **Sifat Material:** chip abu-abu/hijau muda — Ringan, Tahan Air, Mudah Dipotong, Daur Ulang.
- Tombol hijau penuh **Lihat Rekomendasi Produk**.

### Screen 4 — Product Recommendations (`app/scan/rekomendasi.tsx`)

- Header: back + "Rekomendasi Produk".
- Subtitle: "Berikut ide produk yang bisa kamu buat dari material ini."
- **Kartu produk horizontal** (gambar kiri ~96px, konten kanan):
  - Nama produk + ikon bookmark kanan atas.
  - Badge kesulitan (Mudah hijau / Sedang amber).
  - Ikon jam + menit (cth. 45 menit).
  - "Estimasi Harga" label kecil + harga bold hijau (Rp 35.000).
- Contoh data: Pot Tanaman Gantung (Mudah, 45 mnt, Rp 35.000) · Tempat Pensil (Mudah, 30 mnt, Rp 20.000) · Tempat Sabun Cair (Sedang, 60 mnt, Rp 40.000).
- Link bawah: **Lihat Semua Ide (12)** dengan chevron.

### Screen 5 — Product Detail (`app/product/[id]/index.tsx`)

- Header: back kiri; heart + share kanan.
- Gambar produk besar rounded.
- Nama produk bold: "Pot Tanaman Gantung"; badge "Mudah" + "45 menit".
- Deskripsi singkat produk.
- **Baris info** (label kiri, nilai kanan):
  - Estim Biaya → Rp 12.000
  - Est. Harga Jual → Rp 35.000
  - Est. Keuntungan → Rp 23.000
  - Level Kesulitan → Mudah
- **Alat & Bahan:** deretan ikon horizontal (botol, pisau, gunting, lakban, pot) + chip "+3".
- Tombol hijau **Lihat Tutorial Langkah-langkah** → menuju `product/[id]/tutorial`.

### Screen 6 — Visual Tutorial (`app/product/[id]/tutorial.tsx`)

- Header: back + "Tutorial: Pot Tanaman Gantung".
- Indikator progres: "Langkah 1 dari 6" + dots/garis.
- **Langkah bernomor** (lingkaran hijau berisi angka): tiap langkah = gambar kecil kiri + deskripsi kanan:
  1. Cuci botol hingga bersih.
  2. Potong bagian atas botol.
  3. Buat lubang di kedua sisi.
  4. Cat atau hias sesuai selera.
  5. Pasang tali gantungan.
  6. Selesai! Pot tanaman siap digunakan.
- Tips bawah (ikon info): "Gunakan cat akrilik agar tahan lama."

### Screen 7 — Before & After (`app/product/[id]/before-after.tsx`)

- Header: back + "Sebelum & Sesudah".
- Kartu **Sebelum (Sampah)**: foto botol plastik remuk.
- Panah hijau ke bawah di tengah.
- Kartu **Sesudah (Produk Bernilai)**: foto pot tanaman gantung.
- Kartu **Peningkatan Nilai**: `Rp 0` (Sebelum) → `Rp 35.000` (Sesudah) + label "Nilai Naik".

### Screen 8 — Product Mockup (`app/product/[id]/mockup.tsx`)

- Header: back + "Mockup Produk".
- Gambar mockup besar.
- 3 thumbnail kecil dengan label: Dengan Kemasan · Label Produk · Lifestyle Photo.
- Teks tengah: **"Siap Dijual!"** + "Produk kamu terlihat lebih profesional dan menarik untuk dipasarkan."
- Tombol hijau **Lanjut ke Estimasi Harga**.

### Screen 9 — Pricing Estimator (`app/product/[id]/pricing.tsx`)

- Header: back + "Estimasi Harga".
- **Rincian biaya** (label kiri, nilai kanan):
  - Biaya Material → Rp 8.000
  - Aksesoris & Tambahan → Rp 7.000
  - Waktu Pengerjaan (45 mnt) → Rp 10.000
  - Biaya Lain-lain → Rp 2.000
- Kartu hijau muda: "Harga Jual yang Disarankan" → **Rp 35.000** (besar, hijau).
- Kartu hijau muda: "Keuntungan Estimasi" → **Rp 10.000 (28%)** + ikon tren naik.
- Catatan kecil: "Harga dapat disesuaikan dengan kondisi pasar dan kualitas produk."

### Screen 10 — AI Selling Assistant (`app/product/[id]/selling.tsx`)

- Header: back + "AI Selling Assistant".
- **Segmented tabs:** Deskripsi (aktif hijau) · Caption · Hashtag · Tips Foto.
- **Deskripsi Produk** (dengan ikon copy): "Pot tanaman gantung dari botol plastik bekas yang ramah lingkungan, ringan, dan cocok untuk mempercantik ruangan atau taman kamu."
- **Caption Instagram:** "Ubah sampah jadi berkah! 🌱 Pot tanaman gantung handmade dari botol plastik bekas. Yuk, hijaukan bumi sambil berkarya! ♻️ #Upcycling #WASTEX" (dengan ikon copy).
- Dua tombol bawah: **Salin Semua** (putih/outline) + **Bagikan** (hijau).

### Screen 11 — Impact Tracker (`app/(tabs)/impact.tsx`)

- Header: back + "Dampak & Pencapaian".
- **Grid 2×2 kartu statistik** (ikon + angka besar + label):
  - 12.8 kg — Sampah Diolah (ikon recycle)
  - 28 — Produk Dibuat (ikon bintang)
  - Rp 1.250.000 — Nilai Ekonomi (ikon uang)
  - 15 kg — CO₂ Dihimat (ikon daun)
- **Grafik Bulanan:** bar chart hijau, legenda Sampah (kg) & Nilai (Rp), sumbu bulan Jan–Jun.
- **Pencapaian:** deretan badge/medali (daun, hadiah, trofi) + tombol "+".

### Screen 12 — Expert Dashboard / Validasi Skill Baru (`app/expert-dashboard.tsx`)

- Header: back + "Validasi Skill Baru".
- **Tabs:** Menunggu (3) [aktif hijau] · Disetujui · Ditolak.
- **Kartu validasi** (gambar kiri, konten kanan):
  - Judul (cth. "Tas Anyaman dari Plastik Bekas")
  - Sumber: Website / YouTube / Blog
  - Tingkat Risiko: Rendah / Sedang
  - Kesulitan: Mudah / Sedang / Sulit
  - Tombol aksi: **Tinjau** (hijau muda) + **Tolak** (merah muda)
- Contoh item: Tas Anyaman dari Plastik Bekas · Tempat Tisu Minimalis dari Kaleng · Lampu Hias dari Botol Kaca.

---

## 3. Alur Navigasi

```
Landing (1)
  → Upload Waste (2)
  → AI Material Detection (3)
  → Product Recommendations (4)
  → Product Detail (5)
      ├─ Visual Tutorial (6)
      ├─ Before & After (7)
      ├─ Product Mockup (8)
      ├─ Pricing Estimator (9)
      └─ AI Selling Assistant (10)

Tab Bar: Beranda · Explorasi · [Scan] · Dampak (11) · Profil
Profil → Expert Dashboard (12, Preview)
```

---

## 4. Catatan Implementasi Saat Ini

- Bottom nav sudah 5 item dengan tombol Scan mengambang di tengah. ✅
- Layar 5–10 sudah **dipecah menjadi route terpisah** sesuai desain: ✅
  - `app/product/[id]/index.tsx` (Detail) → tombol "Lihat Tutorial Langkah-langkah"
  - `app/product/[id]/tutorial.tsx` (Tutorial) → "Lihat Before & After"
  - `app/product/[id]/before-after.tsx` → "Lihat Mockup Produk"
  - `app/product/[id]/mockup.tsx` → "Lanjut ke Estimasi Harga"
  - `app/product/[id]/pricing.tsx` → "Lanjut ke AI Selling Assistant"
  - `app/product/[id]/selling.tsx` → "Simpan ke Riwayat & Catat Impact"
- Data produk dimuat via hook bersama `src/hooks/useProductData.ts`. ✅
- **Font Inter** sudah terpasang (`expo-font` + `@expo-google-fonts/inter`), dimuat di `app/_layout.tsx`, dan dijadikan font default aplikasi (Android-first; iOS tetap fallback aman). ✅
- Ilustrasi landing (tempat sampah) saat ini masih memakai foto Unsplash — ganti dengan aset ilustrasi vektor bila tersedia.
