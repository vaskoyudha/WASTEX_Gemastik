# Product Requirements Document (PRD) — WASTEX Mobile

**Proyek:** WASTEX — AI Upcycling Agent Berbasis Multimodal-RAG dan Self-Expanding Skill Library  
**Kompetisi:** GEMASTIK XVIII (2026) — Divisi Pengembangan Perangkat Lunak  
**Tim:** WASTEX (UNNES)  
- Vasco Yudha Nodyatama Sera (2404130013) — Mobile Lead  
- Muhammad Falih Akbar (2404130054) — Mobile  
- Kiral Nevan Afriano Hutagalung (2404130139) — Scan Flow & App Skeleton  
**Fase Saat Ini:** Fase 1 — Mobile Prototype (Mock-First, Service Layer Architecture)  
**Dokumen Referensi:** `Outline Gemastik_Wastex (2) - Updated Stack - REVISI.docx` & Design Spec `.omo`

---

## 1. Ringkasan Eksekutif & Visi Produk

### 1.1 Masalah (Problem Statement)
Indonesia menghasilkan **56,63 juta ton sampah** per tahun, di mana **60,99% (34,54 juta ton)** tidak terkelola dan berakhir mencemari lingkungan. Kendala utama masyarakat, bank sampah, dan UMKM bukan hanya ketersediaan infrastruktur, melainkan **knowledge-action gap**: 70% masyarakat yang paham 3R tetap tidak mengolah sampah karena menganggap prosesnya rumit dan melelahkan (*high execution friction*).

### 1.2 Solusi (Product Solution)
**WASTEX** hadir sebagai **AI Upcycling Agent** yang memangkas beban kognitif pengguna dengan mengubah foto sampah anorganik menjadi produk bernilai jual melalui alur terpadu *end-to-end*:
1. **Identifikasi Material (AI Waste Scanner):** Mengenali 5 kategori material (plastik PET/HDPE, kardus, kaleng, kaca, sachet).
2. **Penilaian Risiko Keamanan:** Safety-first approach (Badge risiko: Aman, Hati-hati, Berisiko).
3. **Rekomendasi Produk Upcycling:** Berdasarkan jenis material, kondisi, tingkat kesulitan, dan modal.
4. **Tutorial Visual Bertahap:** Storyboard langkah demi langkah + Peringatan APD/Keamanan.
5. **Estimasi Nilai Ekonomi (Pricing Estimator):** Modal bahan, modal tambahan, harga jual rekomendasi, dan estimasi profit.
6. **Asistensi Pemasaran (AI Selling Assistant):** Deskripsi jualan, caption promosi, saran foto produk, dan ide kemasan.
7. **Pencatatan Dampak (Impact Tracker):** Total sampah diolah, produk dibuat, dan estimasi nilai ekonomi.

---

## 2. Keputusan Arsitektur & Tech Stack

### 2.1 Service Layer + Mock Adapter Architecture
Aplikasi dikembangkan dengan **Service Layer Pattern**. UI (`app/`) **TIDAK BOHLEH** mengimpor data dummy (`src/mocks/`) secara langsung. Seluruh komunikasi data melalui Interface Service Terisolasi (`src/services/types.ts`).

- `USE_MOCK = true`: UI membaca data dari `MockAdapter` yang mensimulasikan delay network, error state, dan edge-case.
- `USE_MOCK = false`: Mengganti implementasi ke `ApiAdapter` (FastAPI / OpenRouter) tanpa menyentuh kode UI/Layar.

### 2.2 Tech Stack
| Layer | Teknologi | Versi / Keterangan |
|---|---|---|
| Framework | **React Native + Expo** | SDK ~57.0 (Expo Router v4 / file-based) |
| Language | **TypeScript** | Strict mode (~6.0) |
| Styling | **NativeWind (Tailwind CSS)** | v4.2.6 (`global.css`, `tailwind.config.js`) |
| State Management | **Zustand** | v5.0 (Scan Session Store, Global App State) |
| Local Storage | **AsyncStorage** | Persist Riwayat, Impact Tracker, & Flag Onboarding |
| Camera & Media | **expo-image-picker** | Ambil foto dari kamera / galeri |
| Icons | **lucide-react-native** | v1.25.0 |

---

## 3. Peta Layar & Alur Pengguna (14 Screens)

```
[Onboarding (3 Slides)]
         │
         ▼
[Tab Navigation Shell] ───┬──► [Beranda] ───────────────┐
                          ├──► [Riwayat]                │ "Scan Sampah"
                          ├──► [Impact Tracker]         │
                          └──► [Profil]                 ▼
                                               [Upload Foto Sampah]
                                                        │ "Analisis"
                                                        ▼
                                               [Hasil Identifikasi]
                                                ├── Badge Risiko
                                                └── Koreksi Manual (Fallback)
                                                        │
                                                        ▼
                                               [Rekomendasi Produk]
                                                        │ Pilih Produk
                                                        ▼
                                               [Detail Produk (4 Tab)]
                                                ├── 1. Tutorial Visual (Safety Modal)
                                                ├── 2. Before-After & Mockup
                                                ├── 3. Estimasi Harga
                                                └── 4. AI Selling Assistant
                                                        │ "Simpan & Catat Impact"
                                                        ▼
                                               [Kembali ke Beranda / Impact]
```

---

## 4. Alokasi Peran & Pembagian Task (Spesifik: KIRAL)

Kiral bertanggung jawab penuh atas **"The Scan Flow & App Skeleton"** (8 Task Kunci):

### Task Breakdown — Kiral

#### `T8` | Base UI Components (`src/components/ui/`)
- **Button:** Variant (primary, secondary, outline, danger), size, state (disabled, loading).
- **Card:** Base card dengan border, shadow, dan padding konsisten.
- **Badge:** Status badge (Aman = Hijau, Hati-hati = Kuning, Berisiko = Merah).
- **Header:** Top navigation bar dengan tombol back dan judul.
- **LoadingSpinner:** Full-screen & inline loading indicator.
- **EmptyState:** Komponen visual saat data kosong (riwayat/impact) + action button.

#### `T10` | Custom Hook `useServiceCall` (`src/hooks/useServiceCall.ts`)
- Wrapper generik untuk memanggil method service async.
- Menangani state: `data`, `loading`, `error`, dan fungsi `refetch/retry`.
- Mensimulasikan UX loading & error handling yang responsif.

#### `T11` | Scan-Session Store (`src/store/useScanStore.ts`)
Zustand store untuk menyimpan data sementara dalam 1 sesi scan:
- `imageUri`: URI foto yang diambil/diunggah.
- `scanResult`: Data `ScanResult` dari `WasteScannerService`.
- `selectedProduct`: Data `ProductRecommendation` yang dipilih pengguna.
- `selectedTutorial`: Data `ProductTutorial`.
- `selectedPricing`: Data `PricingEstimate`.
- `selectedSellingKit`: Data `SellingKit`.
- Actions: `setImageUri`, `setScanResult`, `setSelectedProduct`, `resetSession`.

#### `T12` | Navigation Shell (`app/_layout.tsx` & `app/(tabs)/_layout.tsx`)
- Implementasi Expo Router Root Stack & Bottom Tab Bar (Beranda, Riwayat, Impact, Profil).
- Integrasi Onboarding Guard: Cek `AsyncStorage` untuk flag `hasCompletedOnboarding`.
- Styling Tab Bar dengan NativeWind & `lucide-react-native`.

#### `T13` | Upload Screen (`app/scan/upload.tsx`)
- Integrasi `expo-image-picker` (Kamera & Galeri).
- Image Preview dengan opsi retake/cancel.
- Action Button "Analisis Sampah" yang mentrigger `scanner.scan()` dan navigasi ke Hasil.

#### `T15` | Result Screen / Hasil (`app/scan/hasil.tsx`)
- Menampilkan foto sampel & kartu hasil identifikasi (`MaterialResultCard`).
- Badge Risiko Keamanan (Aman / Hati-hati / Berisiko).
- Fitur **Koreksi Material Manual**: Modal / BottomSheet "Bukan ini? Pilih manual" untuk memilih dari 6 kategori material saat `confidence < 0.7`.
- Tombol "Lihat Rekomendasi Produk".

#### `T17` | Product Detail Screen (`app/product/[id].tsx`)
- Main Shell dengan Internal 4-Tab Navigation:
  1. **Tutorial Visual:** Storyboard langkah demi langkah + **Safety Warning Modal** sebelum langkah berisiko (kaca/kaleng).
  2. **Before-After Preview & Mockup:** Visualisasi transformasi produk.
  3. **Estimasi Harga:** Modal bahan, modal tambahan, rekomendasi harga jual, & estimasi profit.
  4. **AI Selling Assistant:** Nama produk, deskripsi jualan, caption promosi, & tips foto.
- Bottom Floating Action Bar: "Simpan ke Riwayat & Catat Impact".

#### `T21` | Build APK & Assets Documentation
- Konfigurasi `app.json` & EAS Build.
- Trigger `eas build -p android --profile preview` untuk menghasilkan APK Android.
- Menangkap 10 Screenshot Utama untuk melengkapi Tabel 20 / Gambar 8–17 pada dokumen proposal.

---

## 5. Kontrak Data Terbekukan (`src/services/types.ts`)

Seluruh tipe data berikut **TIDAK BOLEH** diubah tanpa persetujuan tim:

```typescript
export type MaterialType = 'plastik_pet' | 'plastik_hdpe' | 'kardus' | 'kaleng' | 'kaca' | 'sachet';
export type RiskLevel = 'aman' | 'hati_hati' | 'berisiko';
export type Difficulty = 'mudah' | 'sedang' | 'sulit';

export interface ScanResult {
  materialType: MaterialType;
  materialLabel: string;
  condition: string;
  confidence: number; // 0-1
  riskLevel: RiskLevel;
  safetyNotes: string[];
  potentialUses: string[];
}

export interface ProductRecommendation {
  id: string;
  name: string;
  thumbnailUri: string;
  difficulty: Difficulty;
  estimatedCost: number;
  estimatedTimeMinutes: number;
  shortDescription: string;
}

export interface TutorialStep {
  order: number;
  title: string;
  description: string;
  imageUri: string;
  safetyWarning?: string;
}

export interface ProductTutorial {
  productId: string;
  steps: TutorialStep[];
  beforeImageUri: string;
  afterImageUri: string;
  mockupImageUri: string;
  toolsAndMaterials: string[];
}

export interface PricingEstimate {
  productId: string;
  materialCost: number;
  additionalCost: number;
  suggestedSellPrice: number;
  estimatedProfit: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  notes: string;
}

export interface SellingKit {
  productId: string;
  productName: string;
  description: string;
  captions: string[];
  photoTips: string[];
  packagingIdeas: string[];
}

export interface SavedProject {
  id: string;
  savedAt: string;
  material: ScanResult;
  product: ProductRecommendation;
  photoUri: string;
}

export interface ImpactSummary {
  totalWasteProcessed: number;
  totalProductsMade: number;
  estimatedEconomicValue: number;
}
```

---

## 6. Definition of Done (DoD) & Kriteria Sukses

Fase mobile dinyatakan **SELESAI** jika:
1. 100% dari 14 layar terhubung dan dapat dinavigasi tanpa crash.
2. Alur scan end-to-end (Upload → Hasil + Safety Badge + Koreksi → Rekomendasi → Detail 4 Tab → Simpan ke AsyncStorage) berfungsi mulus.
3. Seluruh komponen UI dibuat reusable di `src/components/ui/`.
4. `useServiceCall` digunakan konsisten untuk memanggil service dengan loading & error state.
5. APK Android ter-build via EAS dan teruji di HP Android fisik.
6. 10 Screenshot mockup siap untuk proposal GEMASTIK.
