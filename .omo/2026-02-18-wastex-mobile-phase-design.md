# WASTEX Mobile — Rancangan Desain Fase Aplikasi Mobile (Mock-First)

**Tanggal:** 2026-02-18
**Status:** Disetujui untuk implementasi
**Proyek:** WASTEX — AI Upcycling Agent (GEMASTIK XVIII)
**Cakupan dokumen ini:** HANYA fase pembangunan aplikasi mobile dengan AI di-mock. Fase AI (Vision, RAG, Agent, Self-Expanding Skill Library) dan backend (FastAPI/Supabase) berada di luar cakupan dokumen ini dan akan dibuatkan spec terpisah.

---

## 1. Ringkasan Eksekutif

WASTEX adalah aplikasi mobile yang mengubah sampah anorganik menjadi produk bernilai jual melalui identifikasi material, rekomendasi produk, tutorial visual, estimasi harga, dan asistensi pemasaran. Dokumen ini merancang **fase pertama pengembangan**: membangun aplikasi mobile **lengkap secara UI dan navigasi**, dengan seluruh respons AI **disimulasikan (mock)**.

Keputusan scope inti:

- **Bangun mobile dulu, AI belakangan.** Semua kecerdasan (Vision AI, RAG, Agent) ditunda ke fase akhir.
- **AI di-mock.** Respons AI berasal dari data dummy terstruktur di dalam aplikasi.
- **Backend ditunda.** Tidak ada FastAPI/Supabase di fase ini; aplikasi berjalan penuh secara lokal.
- **Arsitektur: Service Layer + Mock Adapter (Pendekatan A).** UI hanya berbicara dengan lapisan service abstrak; implementasi mock dapat ditukar dengan panggilan AI asli tanpa mengubah UI.

Tujuan akhir fase ini: **APK Android yang bisa di-install, menjalankan seluruh alur pengguna end-to-end dengan data mock, dan menghasilkan 10 screenshot untuk melengkapi mockup proposal (Gambar 8–17).**

---

## 2. Konteks & Acuan

Dokumen acuan: `Outline Gemastik_Wastex (2) - Updated Stack - REVISI.docx`.

Poin penting dari versi REVISI yang memengaruhi desain ini:

- LLM final: **DeepSeek-V3** (bukan "V4 Pro"), gateway via **OpenRouter**.
- Platform: mobile lintas platform (Android/iOS), **fokus Android pada rilis awal**.
- Bahasa antarmuka: **Bahasa Indonesia** pada rilis awal.
- Konektivitas: fitur AI butuh internet; hasil dapat disimpan untuk akses luring terbatas.
- Privasi: consent sebelum ambil data, opsi hapus riwayat, selaras UU No. 27/2022 (PDP).
- 5 material utama: **plastik, kardus, kaleng, kaca, kemasan sachet** (plastik dipecah PET & HDPE untuk benchmark → 6 kelas).
- 10 modul fungsional (Tabel 14) & 10 layar mockup (Tabel 16) menjadi basis peta layar.
- Pembeda utama (Tabel 12): identifikasi dari foto, **penilaian risiko keamanan**, skill terverifikasi ahli, estimasi harga + pemasaran, self-expanding, alur terpadu.

### 2.1 Status Tim & Pembagian Peran (fase ini)

Tim 3 orang: 1 fokus persiapan AI (paralel), 2 fokus mobile.

| Kode | Contoh Nama | Peran Fase Ini |
|---|---|---|
| **A** | Vasco | Mobile Lead — Alur & Navigasi |
| **B** | Falih | Mobile — Detail Produk & Data Lokal |
| **C** | Kiral | AI Prep (paralel, belum integrasi) |

---

## 3. Keputusan Arsitektur

### 3.1 Pendekatan: Service Layer + Mock Adapter

Screen di aplikasi **tidak pernah** memanggil API atau data mentah secara langsung. Screen hanya memanggil **service** melalui interface yang stabil. Di fase ini, service diisi implementasi **mock**; di fase AI, implementasi diganti menjadi **API** tanpa menyentuh UI.

Manfaat:

- UI 100% jalan tanpa server.
- Transisi ke AI = mengganti isi service, bukan membongkar layar.
- Anggota AI (C) memakai kontrak data (`types.ts`) sebagai **spesifikasi output API** yang harus ia bangun — kerja paralel tanpa saling tunggu.
- Loading/empty/error state teruji sejak awal karena mock mensimulasikan delay & kegagalan.

Sentuhan lokal (dari Pendekatan C) hanya untuk **Riwayat** dan **Impact Tracker**: disimpan di `AsyncStorage` agar demo terasa hidup (data persist antar sesi). Tidak ada database lokal kompleks / sinkronisasi.

### 3.2 Tumpukan Teknologi (fase mobile)

| Aspek | Pilihan | Alasan |
|---|---|---|
| Framework | Expo (React Native) + TypeScript | Cross-platform 1 basis kode, sesuai proposal |
| Styling | NativeWind (Tailwind untuk RN) | Sesuai proposal, cepat & konsisten |
| Navigasi | Expo Router (file-based) | Cepat dibangun, deep-link gratis, struktur jelas untuk tim paralel |
| State global | Zustand | Ringan, boilerplate minim, cukup untuk kebutuhan WASTEX |
| Penyimpanan lokal | AsyncStorage | Riwayat, Impact, flag onboarding |
| Foto | expo-image-picker | Kamera & galeri |
| Ikon | lucide-react-native | Konsisten, ringan |
| Kualitas kode | ESLint + Prettier | Standar tim |

### 3.3 Struktur Folder

```
wastex-mobile/
├── app/                      # Expo Router — semua rute/screen
│   ├── _layout.tsx           # Root navigation + cek onboarding
│   ├── onboarding.tsx        # 3-slide intro (fitur tambahan #1)
│   ├── (tabs)/               # Tab utama
│   │   ├── _layout.tsx       # Tab bar
│   │   ├── index.tsx         # Beranda
│   │   ├── riwayat.tsx       # Riwayat
│   │   ├── impact.tsx        # Impact Tracker
│   │   └── profil.tsx        # Profil
│   ├── scan/
│   │   ├── upload.tsx        # (1) Upload Foto
│   │   ├── hasil.tsx         # (2) Hasil Identifikasi + badge risiko + koreksi manual
│   │   └── rekomendasi.tsx   # (3) Rekomendasi Produk
│   └── product/
│       └── [id].tsx          # (4) Detail Produk (4 tab internal)
├── src/
│   ├── services/             # ★ LAPISAN KUNCI
│   │   ├── types.ts          # Kontrak data seluruh service
│   │   ├── scanner/          # WasteScannerService (interface + MockScanner)
│   │   ├── recommendation/   # RecommendationService
│   │   ├── tutorial/         # TutorialService
│   │   ├── pricing/          # PricingService
│   │   ├── selling/          # SellingAssistantService
│   │   ├── impact/           # ImpactService (AsyncStorage)
│   │   └── index.ts          # Registry: switch mock ↔ real (USE_MOCK)
│   ├── components/           # UI reusable: Button, Card, Badge, Header, dst
│   ├── features/             # Komponen per fitur: MaterialResultCard, ProductCard, dst
│   ├── store/                # Zustand stores (scan session, riwayat, impact)
│   ├── mocks/                # Data dummy: materials, products, tutorials, pricing, selling
│   └── lib/                  # theme, konstanta, helper
```

**Aturan mutlak:** file di `app/` hanya boleh mengimpor dari `src/services`, `src/components`, `src/features`, `src/store`, `src/lib`. Tidak boleh mengimpor `src/mocks` langsung. Ini menjaga UI tetap bersih dari sumber data.

---

## 4. Kontrak Data (Service Layer)

Bagian ini mendefinisikan bentuk data yang dipakai UI (sekarang, via mock) dan AI (nanti, via API). Kontrak ini **di-freeze di akhir Minggu 2** dan menjadi titik sinkron antara tim mobile (A, B) dan tim AI (C).

### 4.1 Enum & Tipe Bersama (`src/services/types.ts`)

```typescript
export type MaterialType =
  | 'plastik_pet' | 'plastik_hdpe' | 'kardus' | 'kaleng' | 'kaca' | 'sachet';

export type RiskLevel = 'aman' | 'hati_hati' | 'berisiko';
export type Difficulty = 'mudah' | 'sedang' | 'sulit';
```

### 4.2 WasteScannerService

```typescript
export interface ScanResult {
  materialType: MaterialType;
  materialLabel: string;        // "Botol Plastik PET"
  condition: string;            // "Utuh, sedikit kotor"
  confidence: number;           // 0–1; <0.7 memicu saran koreksi manual
  riskLevel: RiskLevel;         // → badge & modal keselamatan
  safetyNotes: string[];        // ditampilkan di modal peringatan
  potentialUses: string[];      // ringkasan potensi pemanfaatan
}

export interface WasteScannerService {
  scan(imageUri: string): Promise<ScanResult>;
  // fase AI: MockScanner → ApiScanner (POST /scan)
}
```

Perilaku `MockScanner`: delay 1,5–2,5 dtk; dapat dikonfigurasi mengembalikan skenario tertentu (untuk demo/QA); sesekali mengembalikan `confidence < 0.7` untuk menguji alur koreksi manual.

### 4.3 RecommendationService

```typescript
export interface ProductRecommendation {
  id: string;
  name: string;                 // "Vas Dekoratif"
  thumbnailUri: string;         // gambar mock
  difficulty: Difficulty;
  estimatedCost: number;        // Rupiah, modal perkiraan
  estimatedTimeMinutes: number;
  shortDescription: string;
}

export interface RecommendationService {
  getRecommendations(material: ScanResult): Promise<ProductRecommendation[]>;
}
```

### 4.4 TutorialService

```typescript
export interface TutorialStep {
  order: number;
  title: string;
  description: string;
  imageUri: string;             // gambar storyboard mock
  safetyWarning?: string;       // muncul di langkah berisiko
}

export interface ProductTutorial {
  productId: string;
  steps: TutorialStep[];
  beforeImageUri: string;       // Before-After Preview
  afterImageUri: string;
  mockupImageUri: string;       // Product Mockup
  toolsAndMaterials: string[];
}

export interface TutorialService {
  getTutorial(productId: string): Promise<ProductTutorial>;
}
```

### 4.5 PricingService

```typescript
export interface PricingEstimate {
  productId: string;
  materialCost: number;         // modal bahan
  additionalCost: number;       // bahan tambahan
  suggestedSellPrice: number;   // harga jual rekomendasi
  estimatedProfit: number;
  priceRangeLow: number;        // rentang pasar
  priceRangeHigh: number;
  notes: string;                // catatan rekomendatif
}

export interface PricingService {
  estimatePrice(productId: string): Promise<PricingEstimate>;
}
```

### 4.6 SellingAssistantService

```typescript
export interface SellingKit {
  productId: string;
  productName: string;          // saran nama jual
  description: string;          // deskripsi jualan
  captions: string[];           // beberapa opsi caption promosi
  photoTips: string[];          // saran foto produk
  packagingIdeas: string[];     // ide kemasan
}

export interface SellingAssistantService {
  getSellingKit(productId: string): Promise<SellingKit>;
}
```

### 4.7 ImpactService (lokal, AsyncStorage)

```typescript
export interface SavedProject {
  id: string;
  savedAt: string;              // ISO date
  material: ScanResult;
  product: ProductRecommendation;
  photoUri: string;             // foto asli pengguna (lokal)
}

export interface ImpactSummary {
  totalWasteProcessed: number;  // jumlah item sampah diolah
  totalProductsMade: number;
  estimatedEconomicValue: number; // akumulasi Rupiah
}

export interface ImpactService {
  saveProject(project: SavedProject): Promise<void>;
  getHistory(): Promise<SavedProject[]>;
  getImpactSummary(): Promise<ImpactSummary>;
  deleteProject(id: string): Promise<void>;
  clearAll(): Promise<void>;    // opsi hapus data (privasi)
}
```

### 4.8 Service Registry (`src/services/index.ts`)

```typescript
const USE_MOCK = true;   // fase AI: ubah menjadi false

export const scanner: WasteScannerService =
  USE_MOCK ? new MockScanner() : new ApiScanner();
export const recommendation: RecommendationService =
  USE_MOCK ? new MockRecommendation() : new ApiRecommendation();
export const tutorial: TutorialService =
  USE_MOCK ? new MockTutorial() : new ApiTutorial();
export const pricing: PricingService =
  USE_MOCK ? new MockPricing() : new ApiPricing();
export const selling: SellingAssistantService =
  USE_MOCK ? new MockSelling() : new ApiSelling();
export const impact: ImpactService = new LocalImpactService(); // tetap lokal
```

---

## 5. Peta Layar & Alur Navigasi

13 layar = 10 layar asli (Tabel 16) + 3 fitur tambahan yang disetujui (onboarding, safety modal, koreksi manual).

### 5.1 Tab Bar (4 tab utama)

1. **Beranda** — ringkasan fungsi, tombol besar "Scan Sampah", cara pakai singkat, shortcut riwayat terakhir.
2. **Riwayat** — daftar scan/proyek tersimpan (AsyncStorage), dapat dibuka lagi.
3. **Impact** — Impact Tracker: total sampah diolah, produk dibuat, estimasi nilai ekonomi (angka + grafik sederhana).
4. **Profil** — info user (mock), pengaturan, **opsi hapus data**.

### 5.2 Alur Scan (stack linear, di luar tab)

```
[Beranda] → "Scan"
  → (1) Upload Foto: pilih kamera/galeri → preview → "Analisis"
  → (2) Hasil Identifikasi: material, kondisi, confidence,
        BADGE RISIKO (aman/hati-hati/berisiko),
        tombol "Bukan ini? Pilih manual" → daftar 5 material
  → (3) Rekomendasi Produk: daftar kartu (nama, kesulitan, estimasi modal, waktu)
        → pilih produk
  → (4) Detail Produk (4 tab internal):
        ├─ Tutorial Visual (storyboard; MODAL KESELAMATAN sebelum langkah berisiko)
        ├─ Before-After Preview & Mockup
        ├─ Estimasi Harga (modal, harga jual, profit)
        └─ AI Selling Assistant (nama, deskripsi, caption, foto, kemasan)
  → "Simpan ke Riwayat & Catat Impact" → kembali ke Beranda, Impact ter-update
```

### 5.3 Onboarding

3 slide singkat saat pertama buka aplikasi (flag di AsyncStorage): "Foto sampahmu → Dapat ide produk → Jual". Dapat dilewati.

### 5.4 Mock vs Nyata di fase ini

| Elemen | Fase mobile |
|---|---|
| Upload foto | **Nyata** — kamera/galeri jalan, foto disimpan lokal |
| Identifikasi material | **Mock** — foto apa pun → hasil dummy (skenario dapat dipilih) |
| Rekomendasi / tutorial / pricing / selling | **Mock** — dari `src/mocks/` |
| Riwayat & Impact | **Nyata** — AsyncStorage |
| Onboarding & hapus data | **Nyata** |

---

## 6. Fitur Tambahan yang Disetujui

1. **Onboarding 3-slide** — memperjelas value dalam detik pertama; penting untuk demo juri.
2. **Treatment Safety-First** — pembeda utama vs kompetitor (Tabel 12):
   - Badge risiko (Aman / Hati-hati / Berisiko) di layar Hasil Identifikasi.
   - Modal peringatan keselamatan sebelum tutorial material tajam/pecah (kaca, kaleng), menyebut APD (sarung tangan, kacamata).
3. **Koreksi material manual** — fallback saat `confidence < 0.7`: tombol "Bukan ini? Pilih manual" → daftar 5 material. Membuat alur terasa jujur & tahan kondisi lapangan.

Ditunda (YAGNI fase ini): favorit/bookmark, share sosmed, push notification, gamifikasi badge kompleks, multi-bahasa, feedback 👍/👎, layar "Jelajahi Ide".

---

## 7. Pembagian Kerja Tim

Pembagian A & B berdasarkan **alur** (bukan lapisan), agar tiap orang punya slice yang bisa didemokan dan konflik minim (titik temu: `types.ts` + komponen reusable). C menyiapkan bahan AI secara paralel memakai kontrak yang sama.

| Anggota | Tanggung Jawab Utama |
|---|---|
| **A** | Setup proyek, Expo Router, tab bar, alur scan (upload → hasil → rekomendasi), Zustand, service `scanner` + `recommendation`, badge risiko, koreksi manual, onboarding |
| **B** | Detail produk (tutorial/preview/pricing/selling), Riwayat, Impact, Profil, service `tutorial`/`pricing`/`selling`/`impact`, AsyncStorage, komponen dasar |
| **C** | Kurasi knowledge base awal (200–500 skill), kumpulkan 600 gambar benchmark, eksperimen prompt Vision & RAG, review `types.ts` sebagai spesifikasi output API, dokumentasi kontrak API untuk fase integrasi |

---

## 8. Timeline Detail (6 Minggu)

Sejalan dengan Sprint 1–2 pada timeline proposal (19 minggu total).

### Minggu 1 — Desain UI & Fondasi Proyek
- **A:** `create-expo-app` + TS + NativeWind + Expo Router; ESLint/Prettier; struktur `src/`; tema NativeWind (warna brand, spacing, font); repo GitHub + branch protection.
- **B:** Komponen dasar (`Button`, `Card`, `Badge`, `Header`, `LoadingSpinner`, `EmptyState`); tipografi & ikon.
- **C:** Palet warna + mood board (tema lingkungan/hijau); mulai wireframe Figma 13 layar bersama A & B.
- **Deliverable:** Wireframe Figma 13 layar; proyek Expo jalan di Expo Go; design system dasar.

### Minggu 2 — Navigasi & Kontrak Data
- **A:** Expo Router: tab bar + stack alur scan; placeholder semua 13 rute; navigasi antar-layar jalan.
- **B:** Tulis `src/services/types.ts` (6 service, bersama C); isi `src/mocks/` (5 material, ±15 produk, tutorial, harga, selling copy).
- **C:** Review `types.ts` dari sudut pandang AI (field output Vision/RAG realistis); mulai kumpulkan gambar benchmark & sumber knowledge base.
- **Deliverable:** Semua layar dapat dibuka (kosong); **`types.ts` di-freeze**; mock data terisi. *Milestone kritis: kontrak beku → A & B paralel penuh.*

### Minggu 3 — Alur Inti Scan
- **A:** Layar Upload (`expo-image-picker`, preview, Analisis); layar Hasil (kartu material + **badge risiko** + confidence + **koreksi manual**); `MockScanner` (delay, skenario, confidence rendah).
- **B:** Layar Rekomendasi (list kartu); `MockRecommendation` (+ filter per material); Zustand `activeScanSession`.
- **C:** Kurasi knowledge base lanjut; eksperimen prompt Vision AI (GPT-4o/Gemini) di luar app.
- **Deliverable:** Upload → Hasil (safety + koreksi manual) → Rekomendasi mulus dengan mock.

### Minggu 4 — Detail Produk, Riwayat & Impact
- **A:** Detail Produk shell + 4 tab; tab Tutorial Visual (storyboard bernomor + gambar mock); **modal keselamatan** sebelum tutorial berisiko.
- **B:** Tab Before-After & Mockup; tab Estimasi Harga (`MockPricing`); tab AI Selling Assistant; layar Riwayat + Impact Tracker + AsyncStorage.
- **C:** RAG pipeline eksperimen (BGE-m3 + pgvector) di lingkungan terpisah; golden dataset 100+ pertanyaan.
- **Deliverable:** Detail produk 4 tab lengkap; "Simpan ke Riwayat & Catat Impact" jalan; Impact ter-update dari data lokal.

### Minggu 5 — Onboarding, Profil & Polish
- **A:** Onboarding 3-slide (flag AsyncStorage); Beranda final (tombol scan besar, cara pakai, shortcut riwayat); loading & empty state rapi.
- **B:** Layar Profil (info mock, pengaturan, **opsi hapus data**); konsistensi visual; animasi transisi ringan.
- **C:** Finalisasi dokumentasi kontrak API (cocok dengan `types.ts`); rencana integrasi fase AI.
- **Deliverable:** Aplikasi lengkap 13 layar; alur end-to-end mulus dengan mock; polish selesai.

### Minggu 6 — QA, Build & Aset Proposal
- **A:** QA alur scan (semua skenario material); `eas build` internal → APK; uji install di beberapa HP Android.
- **B:** QA Riwayat/Impact/Profil (edge case: data kosong, hapus data); **10 screenshot** untuk Tabel 16 (Gambar 8–17).
- **C:** Bantu QA & dokumentasi; konsolidasi bahan AI untuk handoff.
- **Deliverable:** APK stabil ter-install; 10 screenshot proposal; siap demo. *Milestone: fase mobile selesai → siap fase AI (`USE_MOCK = false`).*

---

## 9. Definition of Done (Fase Mobile)

Fase dinyatakan selesai bila:

1. Seluruh 13 layar dapat dinavigasi dan menampilkan data mock dengan benar.
2. Alur scan end-to-end berjalan: upload → hasil (badge + koreksi manual) → rekomendasi → detail 4 tab → simpan → Impact ter-update.
3. Riwayat & Impact persist antar sesi (AsyncStorage); opsi hapus data berfungsi.
4. Onboarding tampil sekali di awal; modal keselamatan tampil untuk material berisiko.
5. Loading & empty state ada di setiap pemanggilan service.
6. `USE_MOCK` bekerja sebagai satu-satunya titik switch; UI tidak mengimpor `src/mocks` langsung.
7. APK internal ter-build via EAS dan ter-install di Android.
8. 10 screenshot layar tersedia untuk proposal.
9. Kode lolos ESLint tanpa error; setiap fitur digabung via pull request yang di-review anggota lain.

---

## 10. Risiko Fase Mobile & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kontrak `types.ts` berubah setelah A/B mulai | Sedang | Freeze di akhir M2; perubahan lewat kesepakatan bersama + review C |
| Mock terlalu "sempurna" hingga loading/error tak teruji | Sedang | Mock wajib pakai delay & sesekali gagal/confidence rendah |
| Scope creep fitur tambahan | Sedang | Hanya #1–#3 yang masuk; sisanya ditunda eksplisit (bagian 6) |
| Desain Figma molor menahan koding | Rendah | M1 cukup wireframe; detail visual disempurnakan sambil koding via NativeWind |
| UI menyulitkan integrasi AI nanti | Tinggi | Aturan: UI hanya via service; kontrak = spesifikasi API untuk C |

---

## 11. Yang TIDAK Termasuk Fase Ini (Handoff ke Fase AI)

- Vision AI asli (GPT/Gemini Vision), LLM (DeepSeek-V3), image generation.
- Multimodal-RAG (BGE-m3 + pgvector), Self-Expanding Skill Library, dashboard verifikasi ahli.
- Backend FastAPI, autentikasi nyata, Supabase (DB/Storage), deployment Railway.
- Integrasi: mengganti implementasi `Mock*` menjadi `Api*` dan `USE_MOCK = false`.

Bahan yang disiapkan C selama fase ini (knowledge base awal, dataset benchmark, dokumentasi kontrak API) menjadi input langsung fase AI sehingga integrasi dapat berjalan cepat.
