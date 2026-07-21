# WASTEX Mobile (Mock-First) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete WASTEX mobile UI and navigation with all AI responses simulated via a swappable mock service layer, producing an installable Android APK that runs the full user flow end-to-end.

**Architecture:** Expo (React Native) + TypeScript with a Service Layer + Mock Adapter pattern. Screens call abstract services (`scanner`, `recommendation`, `tutorial`, `pricing`, `selling`, `impact`) through stable interfaces defined in `src/services/types.ts`. A single `USE_MOCK` flag in the service registry switches mock ↔ real. History and Impact persist locally via AsyncStorage. When the AI phase arrives, only service implementations change — screens are untouched.

**Tech Stack:** Expo SDK 52+, React Native, TypeScript (strict), NativeWind v4, Expo Router, Zustand, AsyncStorage, expo-image-picker, lucide-react-native, Jest + @testing-library/react-native.

**Design spec:** `/home/victus/Documents/gemastik/.omo/2026-02-18-wastex-mobile-phase-design.md`

## Global Constraints

- Interface language: **Bahasa Indonesia** for all user-facing copy.
- 6 material types (verbatim identifiers): `plastik_pet`, `plastik_hdpe`, `kardus`, `kaleng`, `kaca`, `sachet`.
- Risk levels (verbatim): `aman`, `hati_hati`, `berisiko`. Difficulty (verbatim): `mudah`, `sedang`, `sulit`.
- Screens in `app/` may import only from `src/services`, `src/components`, `src/features`, `src/store`, `src/lib`. **Screens must never import `src/mocks` directly.**
- All mock service methods return `Promise` and simulate a 1.5–2.5s delay.
- Confidence `< 0.7` must trigger the manual-correction affordance.
- TypeScript `strict: true`. All code passes ESLint with no errors.
- Currency displayed as Rupiah (e.g., `Rp 15.000`).
- Every feature merged via reviewed pull request; commit after each task.

> **Note on file location:** This environment restricts file writes to `.omo/*.md`. When you begin execution (`/start-work`), the actual project code lives in a real repo directory (e.g., `~/Documents/gemastik/wastex-mobile/`). Paths below are relative to that project root.

---

## File Structure

```
wastex-mobile/
├── app/                          # Expo Router routes (screens only; thin)
│   ├── _layout.tsx               # Root stack + onboarding gate
│   ├── onboarding.tsx            # 3-slide intro
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tab bar
│   │   ├── index.tsx             # Beranda (Home)
│   │   ├── riwayat.tsx           # History
│   │   ├── impact.tsx            # Impact Tracker
│   │   └── profil.tsx            # Profile
│   ├── scan/
│   │   ├── upload.tsx            # (1) Upload photo
│   │   ├── hasil.tsx             # (2) Identification result
│   │   └── rekomendasi.tsx       # (3) Product recommendations
│   └── product/
│       └── [id].tsx              # (4) Product detail (4 internal tabs)
├── src/
│   ├── services/
│   │   ├── types.ts              # All data contracts (frozen end of Week 2)
│   │   ├── delay.ts              # Shared mock-delay helper
│   │   ├── scanner/index.ts      # WasteScannerService + MockScanner
│   │   ├── recommendation/index.ts
│   │   ├── tutorial/index.ts
│   │   ├── pricing/index.ts
│   │   ├── selling/index.ts
│   │   ├── impact/index.ts       # LocalImpactService (AsyncStorage)
│   │   └── index.ts              # Registry (USE_MOCK switch)
│   ├── mocks/
│   │   ├── materials.ts
│   │   ├── products.ts
│   │   ├── tutorials.ts
│   │   ├── pricing.ts
│   │   └── selling.ts
│   ├── store/
│   │   ├── scanSession.ts        # Active scan flow state
│   │   └── useImpact.ts          # Impact/history hook wrapper
│   ├── components/               # Button, Card, Badge, Header, LoadingSpinner, EmptyState
│   ├── features/                 # MaterialResultCard, ProductCard, TutorialStepCard, SafetyModal, RiskBadge
│   └── lib/
│       ├── theme.ts              # Colors, spacing tokens
│       └── format.ts             # formatRupiah, etc.
├── global.css                    # Tailwind directives
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
├── nativewind-env.d.ts
├── tsconfig.json
└── package.json
```

---

## Task 1: Project scaffold + NativeWind + Expo Router

**Files:**
- Create: `package.json` (via generator), `app.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`, `tsconfig.json`, `app/_layout.tsx`, `app/index.tsx` (temporary)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running Expo app with NativeWind classes working; Expo Router active.

- [ ] **Step 1: Scaffold the Expo + TypeScript + Router project**

Run:
```bash
cd ~/Documents/gemastik
npx create-expo-app@latest wastex-mobile
cd wastex-mobile
```
(The default template includes TypeScript and Expo Router.)

- [ ] **Step 2: Install NativeWind and dependencies**

Run:
```bash
npm install nativewind react-native-reanimated tailwindcss
npm install zustand @react-native-async-storage/async-storage
npx expo install expo-image-picker
npm install lucide-react-native react-native-svg
npm install -D @testing-library/react-native @testing-library/jest-native jest jest-expo
```

- [ ] **Step 3: Create NativeWind config files**

Create `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#16a34a", dark: "#15803d", light: "#dcfce7" },
        risk: { aman: "#16a34a", hati: "#d97706", bahaya: "#dc2626" },
      },
    },
  },
  plugins: [],
};
```

Create `global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

Create `metro.config.js`:
```javascript
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

Create `nativewind-env.d.ts`:
```typescript
/// <reference types="nativewind/types" />
```

- [ ] **Step 4: Configure tsconfig for strict + NativeWind**

Overwrite `tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["nativewind/types"]
  },
  "include": ["**/*.ts", "**/*.tsx", "nativewind-env.d.ts"]
}
```

- [ ] **Step 5: Wire global.css into the root layout**

Overwrite `app/_layout.tsx`:
```tsx
import "../global.css";
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Overwrite `app/index.tsx` (temporary smoke screen):
```tsx
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-brand-light">
      <Text className="text-2xl font-bold text-brand-dark">WASTEX</Text>
    </View>
  );
}
```

- [ ] **Step 6: Run and verify NativeWind renders**

Run: `npx expo start`
Expected: App loads in Expo Go / emulator showing "WASTEX" in green bold text on a light-green background (confirms NativeWind classes compile and apply).

- [ ] **Step 7: Commit**

```bash
git init && git add -A
git commit -m "chore: scaffold Expo + NativeWind + Expo Router"
```

---

## Task 2: Theme tokens + Rupiah formatter (with tests)

**Files:**
- Create: `src/lib/theme.ts`, `src/lib/format.ts`, `src/lib/__tests__/format.test.ts`
- Create: `jest.config.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `formatRupiah(value: number): string`; `RISK_META` and `DIFFICULTY_META` label/color maps.

- [ ] **Step 1: Configure Jest**

Create `jest.config.js`:
```javascript
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|lucide-react-native))",
  ],
};
```

Add to `package.json` scripts: `"test": "jest"`.

- [ ] **Step 2: Write the failing test for formatRupiah**

Create `src/lib/__tests__/format.test.ts`:
```typescript
import { formatRupiah } from "../format";

describe("formatRupiah", () => {
  it("formats thousands with dot separators and Rp prefix", () => {
    expect(formatRupiah(15000)).toBe("Rp 15.000");
  });
  it("formats zero", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
  });
  it("formats millions", () => {
    expect(formatRupiah(1250000)).toBe("Rp 1.250.000");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- format`
Expected: FAIL — "Cannot find module '../format'".

- [ ] **Step 4: Implement theme + format**

Create `src/lib/theme.ts`:
```typescript
import type { RiskLevel, Difficulty } from "@/services/types";

export const RISK_META: Record<RiskLevel, { label: string; color: string }> = {
  aman: { label: "Aman", color: "#16a34a" },
  hati_hati: { label: "Hati-hati", color: "#d97706" },
  berisiko: { label: "Berisiko", color: "#dc2626" },
};

export const DIFFICULTY_META: Record<Difficulty, { label: string }> = {
  mudah: { label: "Mudah" },
  sedang: { label: "Sedang" },
  sulit: { label: "Sulit" },
};
```

Create `src/lib/format.ts`:
```typescript
export function formatRupiah(value: number): string {
  return "Rp " + Math.round(value).toLocaleString("id-ID");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- format`
Expected: PASS (3 tests).

> Note: Task 2 imports `@/services/types` in `theme.ts`, which Task 3 creates. If executing strictly in order, create `theme.ts` after Task 3, or temporarily inline the types. Recommended: run Task 3 first, then this step. The plan lists Task 2 first only because `format.ts` is independent.

- [ ] **Step 6: Commit**

```bash
git add src/lib jest.config.js package.json
git commit -m "feat: add Rupiah formatter and theme tokens with tests"
```

---

## Task 3: Data contracts — `src/services/types.ts` (FROZEN)

**Files:**
- Create: `src/services/types.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: ALL shared types and service interfaces. Every later task depends on these exact names. This file is frozen at end of Week 2 per the spec.

- [ ] **Step 1: Write the complete contract file**

Create `src/services/types.ts`:
```typescript
// ---- Shared enums ----
export type MaterialType =
  | "plastik_pet" | "plastik_hdpe" | "kardus" | "kaleng" | "kaca" | "sachet";
export type RiskLevel = "aman" | "hati_hati" | "berisiko";
export type Difficulty = "mudah" | "sedang" | "sulit";

// ---- Scanner ----
export interface ScanResult {
  materialType: MaterialType;
  materialLabel: string;
  condition: string;
  confidence: number;          // 0–1; <0.7 triggers manual correction
  riskLevel: RiskLevel;
  safetyNotes: string[];
  potentialUses: string[];
}
export interface WasteScannerService {
  scan(imageUri: string): Promise<ScanResult>;
}

// ---- Recommendation ----
export interface ProductRecommendation {
  id: string;
  name: string;
  thumbnailUri: string;
  difficulty: Difficulty;
  estimatedCost: number;
  estimatedTimeMinutes: number;
  shortDescription: string;
}
export interface RecommendationService {
  getRecommendations(material: ScanResult): Promise<ProductRecommendation[]>;
}

// ---- Tutorial ----
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
export interface TutorialService {
  getTutorial(productId: string): Promise<ProductTutorial>;
}

// ---- Pricing ----
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
export interface PricingService {
  estimatePrice(productId: string): Promise<PricingEstimate>;
}

// ---- Selling ----
export interface SellingKit {
  productId: string;
  productName: string;
  description: string;
  captions: string[];
  photoTips: string[];
  packagingIdeas: string[];
}
export interface SellingAssistantService {
  getSellingKit(productId: string): Promise<SellingKit>;
}

// ---- Impact / History (local) ----
export interface SavedProject {
  id: string;
  savedAt: string;             // ISO date
  material: ScanResult;
  product: ProductRecommendation;
  photoUri: string;
}
export interface ImpactSummary {
  totalWasteProcessed: number;
  totalProductsMade: number;
  estimatedEconomicValue: number;
}
export interface ImpactService {
  saveProject(project: SavedProject): Promise<void>;
  getHistory(): Promise<SavedProject[]>;
  getImpactSummary(): Promise<ImpactSummary>;
  deleteProject(id: string): Promise<void>;
  clearAll(): Promise<void>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors from `types.ts` (errors about missing screens are fine at this stage if any; there should be none yet).

- [ ] **Step 3: Commit**

```bash
git add src/services/types.ts
git commit -m "feat: define frozen service data contracts"
```

---

## Task 4: Mock data sets

**Files:**
- Create: `src/mocks/materials.ts`, `src/mocks/products.ts`, `src/mocks/tutorials.ts`, `src/mocks/pricing.ts`, `src/mocks/selling.ts`

**Interfaces:**
- Consumes: types from Task 3.
- Produces: `MOCK_MATERIALS` (Record<MaterialType, ScanResult>), `MOCK_PRODUCTS` (Record<MaterialType, ProductRecommendation[]>), `MOCK_TUTORIALS` (Record<string, ProductTutorial>), `MOCK_PRICING` (Record<string, PricingEstimate>), `MOCK_SELLING` (Record<string, SellingKit>).

> Provides demo-ready coverage: at minimum `kaca` and `plastik_pet` fully populated (the two proposal scenarios), plus the other 4 materials with one product each. `imageUri`/`thumbnailUri` use `https://placehold.co/...` placeholders so no local asset wiring is needed.

- [ ] **Step 1: Create materials mock**

Create `src/mocks/materials.ts`:
```typescript
import type { MaterialType, ScanResult } from "@/services/types";

export const MOCK_MATERIALS: Record<MaterialType, ScanResult> = {
  plastik_pet: {
    materialType: "plastik_pet",
    materialLabel: "Botol Plastik PET",
    condition: "Utuh, sedikit kotor",
    confidence: 0.92,
    riskLevel: "aman",
    safetyNotes: ["Cuci bersih sebelum digunakan"],
    potentialUses: ["Pot tanaman gantung", "Wadah hidroponik", "Lampu hias"],
  },
  plastik_hdpe: {
    materialType: "plastik_hdpe",
    materialLabel: "Botol Plastik HDPE",
    condition: "Utuh",
    confidence: 0.88,
    riskLevel: "aman",
    safetyNotes: ["Cuci bersih sebelum digunakan"],
    potentialUses: ["Pot tanaman", "Tempat alat tulis"],
  },
  kardus: {
    materialType: "kardus",
    materialLabel: "Kardus Bekas",
    condition: "Kering, tidak sobek",
    confidence: 0.9,
    riskLevel: "aman",
    safetyNotes: ["Hindari kardus basah/berjamur"],
    potentialUses: ["Rak organizer", "Bingkai foto", "Kotak penyimpanan"],
  },
  kaleng: {
    materialType: "kaleng",
    materialLabel: "Kaleng Bekas",
    condition: "Utuh, tepi tajam",
    confidence: 0.86,
    riskLevel: "hati_hati",
    safetyNotes: ["Tepi kaleng tajam", "Gunakan sarung tangan"],
    potentialUses: ["Pot sukulen", "Tempat pensil", "Lampu hias"],
  },
  kaca: {
    materialType: "kaca",
    materialLabel: "Botol Kaca",
    condition: "Utuh",
    confidence: 0.91,
    riskLevel: "berisiko",
    safetyNotes: [
      "Kaca mudah pecah dan melukai",
      "Gunakan sarung tangan dan kacamata pelindung",
      "Hindari pemotongan kaca untuk pemula",
    ],
    potentialUses: ["Vas dekoratif", "Terrarium mini", "Lampu hias botol"],
  },
  sachet: {
    materialType: "sachet",
    materialLabel: "Kemasan Sachet Multilayer",
    condition: "Bersih, kering",
    confidence: 0.64,
    riskLevel: "aman",
    safetyNotes: ["Cuci dan keringkan sebelum dianyam"],
    potentialUses: ["Tas anyaman", "Dompet", "Alas meja"],
  },
};
```

- [ ] **Step 2: Create products mock**

Create `src/mocks/products.ts`:
```typescript
import type { MaterialType, ProductRecommendation } from "@/services/types";

const img = (t: string) => `https://placehold.co/400x300?text=${encodeURIComponent(t)}`;

export const MOCK_PRODUCTS: Record<MaterialType, ProductRecommendation[]> = {
  kaca: [
    { id: "kaca-vas", name: "Vas Dekoratif", thumbnailUri: img("Vas"), difficulty: "mudah", estimatedCost: 8000, estimatedTimeMinutes: 30, shortDescription: "Vas cantik dari botol kaca tanpa pemotongan." },
    { id: "kaca-terrarium", name: "Terrarium Mini", thumbnailUri: img("Terrarium"), difficulty: "sedang", estimatedCost: 20000, estimatedTimeMinutes: 60, shortDescription: "Taman mini di dalam botol kaca." },
    { id: "kaca-lampu", name: "Lampu Hias Botol", thumbnailUri: img("Lampu"), difficulty: "sedang", estimatedCost: 25000, estimatedTimeMinutes: 45, shortDescription: "Lampu ambient dari botol kaca." },
  ],
  plastik_pet: [
    { id: "pet-pot", name: "Pot Tanaman Gantung", thumbnailUri: img("Pot"), difficulty: "mudah", estimatedCost: 5000, estimatedTimeMinutes: 25, shortDescription: "Pot gantung dari botol PET." },
    { id: "pet-hidroponik", name: "Wadah Hidroponik", thumbnailUri: img("Hidroponik"), difficulty: "sedang", estimatedCost: 12000, estimatedTimeMinutes: 40, shortDescription: "Sistem tanam sederhana dari botol." },
    { id: "pet-lampu", name: "Lampu Hias", thumbnailUri: img("LampuPET"), difficulty: "sedang", estimatedCost: 15000, estimatedTimeMinutes: 50, shortDescription: "Lampu dekoratif dari botol PET." },
  ],
  plastik_hdpe: [
    { id: "hdpe-pot", name: "Pot Tanaman", thumbnailUri: img("PotHDPE"), difficulty: "mudah", estimatedCost: 4000, estimatedTimeMinutes: 20, shortDescription: "Pot kokoh dari botol HDPE." },
  ],
  kardus: [
    { id: "kardus-organizer", name: "Rak Organizer", thumbnailUri: img("Organizer"), difficulty: "sedang", estimatedCost: 10000, estimatedTimeMinutes: 60, shortDescription: "Rak meja dari kardus bekas." },
  ],
  kaleng: [
    { id: "kaleng-pot", name: "Pot Sukulen", thumbnailUri: img("PotKaleng"), difficulty: "mudah", estimatedCost: 6000, estimatedTimeMinutes: 30, shortDescription: "Pot sukulen dari kaleng bekas." },
  ],
  sachet: [
    { id: "sachet-tas", name: "Tas Anyaman", thumbnailUri: img("Tas"), difficulty: "sulit", estimatedCost: 15000, estimatedTimeMinutes: 180, shortDescription: "Tas anyaman dari sachet multilayer." },
  ],
};
```

- [ ] **Step 3: Create tutorials, pricing, selling mocks**

Create `src/mocks/tutorials.ts`:
```typescript
import type { ProductTutorial } from "@/services/types";

const img = (t: string) => `https://placehold.co/400x300?text=${encodeURIComponent(t)}`;

export const MOCK_TUTORIALS: Record<string, ProductTutorial> = {
  "kaca-vas": {
    productId: "kaca-vas",
    beforeImageUri: img("Botol+Kaca"),
    afterImageUri: img("Vas+Jadi"),
    mockupImageUri: img("Mockup+Vas"),
    toolsAndMaterials: ["Botol kaca", "Air sabun", "Tali rami", "Cat akrilik", "Sarung tangan"],
    steps: [
      { order: 1, title: "Bersihkan botol", description: "Cuci botol dengan air sabun hingga bersih.", imageUri: img("Langkah+1") },
      { order: 2, title: "Hilangkan label", description: "Rendam air hangat lalu kelupas label.", imageUri: img("Langkah+2") },
      { order: 3, title: "Keringkan botol", description: "Keringkan sepenuhnya sebelum dihias.", imageUri: img("Langkah+3") },
      { order: 4, title: "Hias bagian luar", description: "Cat atau lilit tali rami sesuai selera.", imageUri: img("Langkah+4"), safetyWarning: "Hati-hati, kaca mudah pecah. Gunakan sarung tangan." },
      { order: 5, title: "Tambahkan aksen", description: "Tambahkan label dekoratif atau pita.", imageUri: img("Langkah+5") },
      { order: 6, title: "Selesai", description: "Vas dekoratif siap dipajang atau dijual.", imageUri: img("Langkah+6") },
    ],
  },
  "pet-pot": {
    productId: "pet-pot",
    beforeImageUri: img("Botol+PET"),
    afterImageUri: img("Pot+Jadi"),
    mockupImageUri: img("Mockup+Pot"),
    toolsAndMaterials: ["Botol PET", "Gunting", "Tali", "Cat", "Paku (lubang drainase)"],
    steps: [
      { order: 1, title: "Cuci botol", description: "Bersihkan botol dari sisa isi.", imageUri: img("PET+1") },
      { order: 2, title: "Potong botol", description: "Potong bagian atas botol.", imageUri: img("PET+2"), safetyWarning: "Gunting tajam — potong perlahan." },
      { order: 3, title: "Buat lubang drainase", description: "Lubangi dasar untuk aliran air.", imageUri: img("PET+3") },
      { order: 4, title: "Cat botol", description: "Warnai sesuai selera.", imageUri: img("PET+4") },
      { order: 5, title: "Pasang tali", description: "Pasang tali untuk digantung.", imageUri: img("PET+5") },
      { order: 6, title: "Selesai", description: "Pot gantung siap digunakan.", imageUri: img("PET+6") },
    ],
  },
};
```

Create `src/mocks/pricing.ts`:
```typescript
import type { PricingEstimate } from "@/services/types";

export const MOCK_PRICING: Record<string, PricingEstimate> = {
  "kaca-vas": { productId: "kaca-vas", materialCost: 3000, additionalCost: 5000, suggestedSellPrice: 35000, estimatedProfit: 27000, priceRangeLow: 25000, priceRangeHigh: 50000, notes: "Harga bergantung kerumitan hiasan dan pasar lokal." },
  "pet-pot": { productId: "pet-pot", materialCost: 1000, additionalCost: 4000, suggestedSellPrice: 20000, estimatedProfit: 15000, priceRangeLow: 15000, priceRangeHigh: 30000, notes: "Jual borongan untuk margin lebih baik." },
};
```

Create `src/mocks/selling.ts`:
```typescript
import type { SellingKit } from "@/services/types";

export const MOCK_SELLING: Record<string, SellingKit> = {
  "kaca-vas": {
    productId: "kaca-vas",
    productName: "Vas Kaca Rustic Handmade",
    description: "Vas dekoratif ramah lingkungan dari botol kaca daur ulang, cocok untuk mempercantik ruangan.",
    captions: ["Ubah sampah jadi cantik! Vas rustic handmade ✨♻️", "Dekorasi ramah lingkungan untuk rumahmu 🌿"],
    photoTips: ["Foto dengan cahaya alami", "Latar polos agar produk menonjol", "Tampilkan dengan bunga di dalamnya"],
    packagingIdeas: ["Bungkus kertas coklat + tali rami", "Tambahkan kartu ucapan ramah lingkungan"],
  },
  "pet-pot": {
    productId: "pet-pot",
    productName: "Pot Gantung Eco Hijau",
    description: "Pot tanaman gantung dari botol plastik daur ulang, ringan dan tahan lama.",
    captions: ["Berkebun hemat & ramah bumi 🌱", "Pot gantung eco dari botol bekas! ♻️"],
    photoTips: ["Foto dengan tanaman sudah tertanam", "Gantung di dekat jendela"],
    packagingIdeas: ["Bungkus koran bekas", "Ikat dengan tali jerami"],
  },
};
```

- [ ] **Step 4: Verify compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/mocks
git commit -m "feat: add mock data for materials, products, tutorials, pricing, selling"
```

---

## Task 5: Mock delay helper + Scanner service (with tests)

**Files:**
- Create: `src/services/delay.ts`, `src/services/scanner/index.ts`, `src/services/scanner/__tests__/scanner.test.ts`

**Interfaces:**
- Consumes: `WasteScannerService`, `ScanResult` (Task 3); `MOCK_MATERIALS` (Task 4).
- Produces: `mockDelay(min?, max?)`; `MockScanner` class; `setMockScenario(m: MaterialType | "low_confidence" | null)` for demo/QA control.

- [ ] **Step 1: Write failing test**

Create `src/services/scanner/__tests__/scanner.test.ts`:
```typescript
import { MockScanner, setMockScenario } from "../index";

describe("MockScanner", () => {
  afterEach(() => setMockScenario(null));

  it("returns a valid ScanResult with required fields", async () => {
    const s = new MockScanner(0); // 0ms delay in tests
    const r = await s.scan("file://x.jpg");
    expect(r.materialType).toBeDefined();
    expect(r.confidence).toBeGreaterThan(0);
    expect(Array.isArray(r.safetyNotes)).toBe(true);
  });

  it("returns the forced scenario material", async () => {
    setMockScenario("kaca");
    const s = new MockScanner(0);
    const r = await s.scan("file://x.jpg");
    expect(r.materialType).toBe("kaca");
    expect(r.riskLevel).toBe("berisiko");
  });

  it("returns confidence <0.7 when low_confidence scenario is set", async () => {
    setMockScenario("low_confidence");
    const s = new MockScanner(0);
    const r = await s.scan("file://x.jpg");
    expect(r.confidence).toBeLessThan(0.7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scanner`
Expected: FAIL — cannot find `../index`.

- [ ] **Step 3: Implement delay + scanner**

Create `src/services/delay.ts`:
```typescript
export function mockDelay(min = 1500, max = 2500): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

Create `src/services/scanner/index.ts`:
```typescript
import type { MaterialType, ScanResult, WasteScannerService } from "@/services/types";
import { MOCK_MATERIALS } from "@/mocks/materials";
import { mockDelay } from "@/services/delay";

type Scenario = MaterialType | "low_confidence" | null;
let scenario: Scenario = null;
export function setMockScenario(s: Scenario) { scenario = s; }

const ORDER: MaterialType[] = ["plastik_pet", "kardus", "kaleng", "kaca", "sachet", "plastik_hdpe"];

export class MockScanner implements WasteScannerService {
  constructor(private delayMs?: number) {}

  async scan(_imageUri: string): Promise<ScanResult> {
    await mockDelay(this.delayMs ?? 1500, this.delayMs ?? 2500);
    if (scenario === "low_confidence") {
      return { ...MOCK_MATERIALS.sachet, confidence: 0.55 };
    }
    if (scenario && scenario in MOCK_MATERIALS) {
      return MOCK_MATERIALS[scenario as MaterialType];
    }
    const pick = ORDER[Math.floor(Math.random() * ORDER.length)];
    return MOCK_MATERIALS[pick];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scanner`
Expected: PASS (3 tests). (The `mockDelay` uses `this.delayMs` = 0 in tests, so no real waiting.)

- [ ] **Step 5: Commit**

```bash
git add src/services/delay.ts src/services/scanner
git commit -m "feat: add MockScanner with scenario control and tests"
```

---

## Task 6: Recommendation, Tutorial, Pricing, Selling mock services

**Files:**
- Create: `src/services/recommendation/index.ts`, `src/services/tutorial/index.ts`, `src/services/pricing/index.ts`, `src/services/selling/index.ts`
- Create: `src/services/__tests__/services.test.ts`

**Interfaces:**
- Consumes: types (Task 3); mock data (Task 4); `mockDelay` (Task 5).
- Produces: `MockRecommendation`, `MockTutorial`, `MockPricing`, `MockSelling` classes.

- [ ] **Step 1: Write failing test**

Create `src/services/__tests__/services.test.ts`:
```typescript
import { MockRecommendation } from "../recommendation";
import { MockTutorial } from "../tutorial";
import { MockPricing } from "../pricing";
import { MockSelling } from "../selling";
import { MOCK_MATERIALS } from "@/mocks/materials";

describe("content services", () => {
  it("recommends products for the scanned material", async () => {
    const r = await new MockRecommendation(0).getRecommendations(MOCK_MATERIALS.kaca);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].id).toContain("kaca");
  });
  it("returns a tutorial with ordered steps", async () => {
    const t = await new MockTutorial(0).getTutorial("kaca-vas");
    expect(t.steps[0].order).toBe(1);
    expect(t.steps.length).toBeGreaterThanOrEqual(3);
  });
  it("returns pricing with profit", async () => {
    const p = await new MockPricing(0).estimatePrice("kaca-vas");
    expect(p.suggestedSellPrice).toBeGreaterThan(p.materialCost);
  });
  it("returns a selling kit with at least one caption", async () => {
    const k = await new MockSelling(0).getSellingKit("kaca-vas");
    expect(k.captions.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the four services**

Create `src/services/recommendation/index.ts`:
```typescript
import type { ProductRecommendation, RecommendationService, ScanResult } from "@/services/types";
import { MOCK_PRODUCTS } from "@/mocks/products";
import { mockDelay } from "@/services/delay";

export class MockRecommendation implements RecommendationService {
  constructor(private delayMs?: number) {}
  async getRecommendations(material: ScanResult): Promise<ProductRecommendation[]> {
    await mockDelay(this.delayMs ?? 1500, this.delayMs ?? 2500);
    return MOCK_PRODUCTS[material.materialType] ?? [];
  }
}
```

Create `src/services/tutorial/index.ts`:
```typescript
import type { ProductTutorial, TutorialService } from "@/services/types";
import { MOCK_TUTORIALS } from "@/mocks/tutorials";
import { mockDelay } from "@/services/delay";

const FALLBACK = (productId: string): ProductTutorial => ({
  productId,
  beforeImageUri: "https://placehold.co/400x300?text=Before",
  afterImageUri: "https://placehold.co/400x300?text=After",
  mockupImageUri: "https://placehold.co/400x300?text=Mockup",
  toolsAndMaterials: ["Alat dasar", "Bahan tambahan"],
  steps: [
    { order: 1, title: "Persiapan", description: "Siapkan material dan alat.", imageUri: "https://placehold.co/400x300?text=1" },
    { order: 2, title: "Proses", description: "Kerjakan sesuai desain produk.", imageUri: "https://placehold.co/400x300?text=2" },
    { order: 3, title: "Finishing", description: "Rapikan dan produk siap.", imageUri: "https://placehold.co/400x300?text=3" },
  ],
});

export class MockTutorial implements TutorialService {
  constructor(private delayMs?: number) {}
  async getTutorial(productId: string): Promise<ProductTutorial> {
    await mockDelay(this.delayMs ?? 1500, this.delayMs ?? 2500);
    return MOCK_TUTORIALS[productId] ?? FALLBACK(productId);
  }
}
```

Create `src/services/pricing/index.ts`:
```typescript
import type { PricingEstimate, PricingService } from "@/services/types";
import { MOCK_PRICING } from "@/mocks/pricing";
import { mockDelay } from "@/services/delay";

const FALLBACK = (productId: string): PricingEstimate => ({
  productId, materialCost: 3000, additionalCost: 5000, suggestedSellPrice: 25000,
  estimatedProfit: 17000, priceRangeLow: 18000, priceRangeHigh: 35000,
  notes: "Estimasi umum; sesuaikan dengan pasar lokal.",
});

export class MockPricing implements PricingService {
  constructor(private delayMs?: number) {}
  async estimatePrice(productId: string): Promise<PricingEstimate> {
    await mockDelay(this.delayMs ?? 1500, this.delayMs ?? 2500);
    return MOCK_PRICING[productId] ?? FALLBACK(productId);
  }
}
```

Create `src/services/selling/index.ts`:
```typescript
import type { SellingAssistantService, SellingKit } from "@/services/types";
import { MOCK_SELLING } from "@/mocks/selling";
import { mockDelay } from "@/services/delay";

const FALLBACK = (productId: string): SellingKit => ({
  productId, productName: "Produk Upcycle Ramah Lingkungan",
  description: "Produk hasil daur ulang yang unik dan bernilai jual.",
  captions: ["Produk eco handmade! ♻️"],
  photoTips: ["Gunakan cahaya alami", "Latar polos"],
  packagingIdeas: ["Kemasan kertas daur ulang"],
});

export class MockSelling implements SellingAssistantService {
  constructor(private delayMs?: number) {}
  async getSellingKit(productId: string): Promise<SellingKit> {
    await mockDelay(this.delayMs ?? 1500, this.delayMs ?? 2500);
    return MOCK_SELLING[productId] ?? FALLBACK(productId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/recommendation src/services/tutorial src/services/pricing src/services/selling src/services/__tests__
git commit -m "feat: add recommendation, tutorial, pricing, selling mock services"
```

---

## Task 7: LocalImpactService (AsyncStorage) + registry

**Files:**
- Create: `src/services/impact/index.ts`, `src/services/impact/__tests__/impact.test.ts`, `src/services/index.ts`

**Interfaces:**
- Consumes: `ImpactService`, `SavedProject`, `ImpactSummary` (Task 3).
- Produces: `LocalImpactService`; registry exports `scanner`, `recommendation`, `tutorial`, `pricing`, `selling`, `impact` and the `USE_MOCK` flag.

- [ ] **Step 1: Write failing test (AsyncStorage mocked)**

Create `src/services/impact/__tests__/impact.test.ts`:
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LocalImpactService } from "../index";
import type { SavedProject } from "@/services/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const sample: SavedProject = {
  id: "p1", savedAt: new Date().toISOString(),
  material: { materialType: "kaca", materialLabel: "Botol Kaca", condition: "Utuh", confidence: 0.9, riskLevel: "berisiko", safetyNotes: [], potentialUses: [] },
  product: { id: "kaca-vas", name: "Vas", thumbnailUri: "", difficulty: "mudah", estimatedCost: 8000, estimatedTimeMinutes: 30, shortDescription: "" },
  photoUri: "file://x.jpg",
};

describe("LocalImpactService", () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it("saves and reads back history", async () => {
    const s = new LocalImpactService();
    await s.saveProject(sample);
    const hist = await s.getHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0].id).toBe("p1");
  });

  it("computes impact summary from saved projects", async () => {
    const s = new LocalImpactService();
    await s.saveProject(sample);
    const sum = await s.getImpactSummary();
    expect(sum.totalProductsMade).toBe(1);
    expect(sum.totalWasteProcessed).toBe(1);
    expect(sum.estimatedEconomicValue).toBe(8000);
  });

  it("clears all data", async () => {
    const s = new LocalImpactService();
    await s.saveProject(sample);
    await s.clearAll();
    expect(await s.getHistory()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- impact`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement LocalImpactService**

Create `src/services/impact/index.ts`:
```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ImpactService, ImpactSummary, SavedProject } from "@/services/types";

const KEY = "wastex.history.v1";

export class LocalImpactService implements ImpactService {
  private async readAll(): Promise<SavedProject[]> {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedProject[]) : [];
  }
  private async writeAll(list: SavedProject[]): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  }
  async saveProject(project: SavedProject): Promise<void> {
    const list = await this.readAll();
    list.unshift(project);
    await this.writeAll(list);
  }
  async getHistory(): Promise<SavedProject[]> {
    return this.readAll();
  }
  async getImpactSummary(): Promise<ImpactSummary> {
    const list = await this.readAll();
    return {
      totalWasteProcessed: list.length,
      totalProductsMade: list.length,
      estimatedEconomicValue: list.reduce((sum, p) => sum + p.product.estimatedCost, 0),
    };
  }
  async deleteProject(id: string): Promise<void> {
    const list = (await this.readAll()).filter((p) => p.id !== id);
    await this.writeAll(list);
  }
  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  }
}
```

> Note: `estimatedEconomicValue` uses `product.estimatedCost` as the mock economic-value proxy. The AI phase can replace this with `suggestedSellPrice` from pricing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- impact`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the service registry**

Create `src/services/index.ts`:
```typescript
import type {
  WasteScannerService, RecommendationService, TutorialService,
  PricingService, SellingAssistantService, ImpactService,
} from "@/services/types";
import { MockScanner } from "@/services/scanner";
import { MockRecommendation } from "@/services/recommendation";
import { MockTutorial } from "@/services/tutorial";
import { MockPricing } from "@/services/pricing";
import { MockSelling } from "@/services/selling";
import { LocalImpactService } from "@/services/impact";

export const USE_MOCK = true; // AI phase: set false and add Api* implementations

export const scanner: WasteScannerService = new MockScanner();
export const recommendation: RecommendationService = new MockRecommendation();
export const tutorial: TutorialService = new MockTutorial();
export const pricing: PricingService = new MockPricing();
export const selling: SellingAssistantService = new MockSelling();
export const impact: ImpactService = new LocalImpactService();
```

- [ ] **Step 6: Verify compile + all tests**

Run: `npx tsc --noEmit && npm test`
Expected: No TS errors; all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/impact src/services/index.ts
git commit -m "feat: add LocalImpactService and service registry with USE_MOCK switch"
```

---

## Task 8: Base UI components

**Files:**
- Create: `src/components/Button.tsx`, `src/components/Card.tsx`, `src/components/Badge.tsx`, `src/components/Header.tsx`, `src/components/LoadingSpinner.tsx`, `src/components/EmptyState.tsx`
- Create: `src/components/__tests__/Badge.test.tsx`

**Interfaces:**
- Consumes: NativeWind classes.
- Produces: reusable presentational components used by all screens.

- [ ] **Step 1: Write failing test for Badge**

Create `src/components/__tests__/Badge.test.tsx`:
```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { Badge } from "../Badge";

it("renders its label text", () => {
  const { getByText } = render(<Badge label="Aman" color="#16a34a" />);
  expect(getByText("Aman")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Badge`
Expected: FAIL — cannot find `../Badge`.

- [ ] **Step 3: Implement the components**

Create `src/components/Badge.tsx`:
```tsx
import { Text, View } from "react-native";

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View className="self-start rounded-full px-3 py-1" style={{ backgroundColor: color + "22" }}>
      <Text className="text-xs font-semibold" style={{ color }}>{label}</Text>
    </View>
  );
}
```

Create `src/components/Button.tsx`:
```tsx
import { Pressable, Text } from "react-native";

type Props = { title: string; onPress: () => void; variant?: "primary" | "outline"; disabled?: boolean };

export function Button({ title, onPress, variant = "primary", disabled }: Props) {
  const base = "rounded-xl px-5 py-4 items-center";
  const style = variant === "primary" ? "bg-brand" : "border border-brand bg-white";
  const text = variant === "primary" ? "text-white font-semibold" : "text-brand font-semibold";
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`${base} ${style} ${disabled ? "opacity-50" : ""}`}>
      <Text className={text}>{title}</Text>
    </Pressable>
  );
}
```

Create `src/components/Card.tsx`:
```tsx
import { View } from "react-native";
import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return <View className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">{children}</View>;
}
```

Create `src/components/Header.tsx`:
```tsx
import { Text, View } from "react-native";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="px-5 pt-2 pb-4">
      <Text className="text-2xl font-bold text-gray-900">{title}</Text>
      {subtitle ? <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text> : null}
    </View>
  );
}
```

Create `src/components/LoadingSpinner.tsx`:
```tsx
import { ActivityIndicator, Text, View } from "react-native";

export function LoadingSpinner({ message }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <ActivityIndicator size="large" color="#16a34a" />
      {message ? <Text className="text-gray-500">{message}</Text> : null}
    </View>
  );
}
```

Create `src/components/EmptyState.tsx`:
```tsx
import { Text, View } from "react-native";

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 gap-2">
      <Text className="text-lg font-semibold text-gray-700 text-center">{title}</Text>
      {message ? <Text className="text-sm text-gray-500 text-center">{message}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Badge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: add base UI components (Button, Card, Badge, Header, LoadingSpinner, EmptyState)"
```

---

## Task 9: Feature components — RiskBadge, ProductCard, TutorialStepCard, SafetyModal

**Files:**
- Create: `src/features/RiskBadge.tsx`, `src/features/ProductCard.tsx`, `src/features/TutorialStepCard.tsx`, `src/features/SafetyModal.tsx`
- Create: `src/features/__tests__/RiskBadge.test.tsx`

**Interfaces:**
- Consumes: `RISK_META`, `DIFFICULTY_META` (Task 2); types (Task 3); base components (Task 8).
- Produces: `RiskBadge`, `ProductCard`, `TutorialStepCard`, `SafetyModal`.

- [ ] **Step 1: Write failing test**

Create `src/features/__tests__/RiskBadge.test.tsx`:
```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { RiskBadge } from "../RiskBadge";

it("maps risk level to Indonesian label", () => {
  const { getByText } = render(<RiskBadge level="berisiko" />);
  expect(getByText("Berisiko")).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- RiskBadge`
Expected: FAIL.

- [ ] **Step 3: Implement feature components**

Create `src/features/RiskBadge.tsx`:
```tsx
import { Badge } from "@/components/Badge";
import { RISK_META } from "@/lib/theme";
import type { RiskLevel } from "@/services/types";

export function RiskBadge({ level }: { level: RiskLevel }) {
  const meta = RISK_META[level];
  return <Badge label={meta.label} color={meta.color} />;
}
```

Create `src/features/ProductCard.tsx`:
```tsx
import { Image, Pressable, Text, View } from "react-native";
import { DIFFICULTY_META } from "@/lib/theme";
import { formatRupiah } from "@/lib/format";
import type { ProductRecommendation } from "@/services/types";

export function ProductCard({ product, onPress }: { product: ProductRecommendation; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="rounded-2xl bg-white border border-gray-100 overflow-hidden mb-3">
      <Image source={{ uri: product.thumbnailUri }} className="w-full h-40" />
      <View className="p-4 gap-1">
        <Text className="text-base font-bold text-gray-900">{product.name}</Text>
        <Text className="text-sm text-gray-500">{product.shortDescription}</Text>
        <View className="flex-row justify-between mt-2">
          <Text className="text-xs text-brand-dark font-semibold">{DIFFICULTY_META[product.difficulty].label}</Text>
          <Text className="text-xs text-gray-700">Modal {formatRupiah(product.estimatedCost)}</Text>
          <Text className="text-xs text-gray-700">{product.estimatedTimeMinutes} mnt</Text>
        </View>
      </View>
    </Pressable>
  );
}
```

Create `src/features/TutorialStepCard.tsx`:
```tsx
import { Image, Text, View } from "react-native";
import type { TutorialStep } from "@/services/types";

export function TutorialStepCard({ step }: { step: TutorialStep }) {
  return (
    <View className="flex-row gap-3 mb-4">
      <View className="w-8 h-8 rounded-full bg-brand items-center justify-center">
        <Text className="text-white font-bold">{step.order}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-gray-900">{step.title}</Text>
        <Text className="text-sm text-gray-600 mt-1">{step.description}</Text>
        <Image source={{ uri: step.imageUri }} className="w-full h-32 rounded-xl mt-2" />
        {step.safetyWarning ? (
          <Text className="text-xs text-risk-bahaya mt-1">⚠ {step.safetyWarning}</Text>
        ) : null}
      </View>
    </View>
  );
}
```

Create `src/features/SafetyModal.tsx`:
```tsx
import { Modal, Text, View } from "react-native";
import { Button } from "@/components/Button";

type Props = { visible: boolean; notes: string[]; onConfirm: () => void; onCancel: () => void };

export function SafetyModal({ visible, notes, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white rounded-2xl p-5 w-full gap-3">
          <Text className="text-lg font-bold text-risk-bahaya">Peringatan Keselamatan</Text>
          {notes.map((n, i) => (
            <Text key={i} className="text-sm text-gray-700">• {n}</Text>
          ))}
          <Text className="text-xs text-gray-500">Gunakan alat pelindung seperti sarung tangan dan kacamata pelindung.</Text>
          <View className="gap-2 mt-2">
            <Button title="Saya Mengerti, Lanjutkan" onPress={onConfirm} />
            <Button title="Kembali" variant="outline" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- RiskBadge`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features
git commit -m "feat: add RiskBadge, ProductCard, TutorialStepCard, SafetyModal"
```

---

## Task 10: Scan session store (Zustand, with tests)

**Files:**
- Create: `src/store/scanSession.ts`, `src/store/__tests__/scanSession.test.ts`

**Interfaces:**
- Consumes: types (Task 3).
- Produces: `useScanSession` store with `photoUri`, `result`, `selectedProduct`, and setters `setPhoto`, `setResult`, `selectProduct`, `reset`.

- [ ] **Step 1: Write failing test**

Create `src/store/__tests__/scanSession.test.ts`:
```typescript
import { useScanSession } from "../scanSession";

describe("useScanSession", () => {
  beforeEach(() => useScanSession.getState().reset());

  it("stores photo, result, and selected product", () => {
    const s = useScanSession.getState();
    s.setPhoto("file://a.jpg");
    expect(useScanSession.getState().photoUri).toBe("file://a.jpg");
  });

  it("reset clears everything", () => {
    const s = useScanSession.getState();
    s.setPhoto("file://a.jpg");
    s.reset();
    expect(useScanSession.getState().photoUri).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- scanSession`
Expected: FAIL.

- [ ] **Step 3: Implement store**

Create `src/store/scanSession.ts`:
```typescript
import { create } from "zustand";
import type { ProductRecommendation, ScanResult } from "@/services/types";

type State = {
  photoUri: string | null;
  result: ScanResult | null;
  selectedProduct: ProductRecommendation | null;
  setPhoto: (uri: string) => void;
  setResult: (r: ScanResult) => void;
  selectProduct: (p: ProductRecommendation) => void;
  reset: () => void;
};

export const useScanSession = create<State>((set) => ({
  photoUri: null,
  result: null,
  selectedProduct: null,
  setPhoto: (uri) => set({ photoUri: uri }),
  setResult: (r) => set({ result: r }),
  selectProduct: (p) => set({ selectedProduct: p }),
  reset: () => set({ photoUri: null, result: null, selectedProduct: null }),
}));
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- scanSession`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/scanSession.ts src/store/__tests__
git commit -m "feat: add scan session Zustand store with tests"
```

---

## Task 11: Navigation skeleton — tab bar + onboarding gate

**Files:**
- Modify: `app/_layout.tsx`
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/riwayat.tsx`, `app/(tabs)/impact.tsx`, `app/(tabs)/profil.tsx`, `app/onboarding.tsx`
- Delete: `app/index.tsx` (temporary smoke screen from Task 1)

**Interfaces:**
- Consumes: Expo Router, AsyncStorage, base components.
- Produces: navigable 4-tab shell; onboarding gate reading `wastex.onboarded` flag.

- [ ] **Step 1: Root layout with onboarding gate**

Overwrite `app/_layout.tsx`:
```tsx
import "../global.css";
import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    AsyncStorage.getItem("wastex.onboarded").then((v) => {
      if (!v) router.replace("/onboarding");
      setReady(true);
    });
  }, []);

  if (!ready) return <LoadingSpinner message="Memuat..." />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="scan/upload" options={{ headerShown: true, title: "Scan Sampah" }} />
      <Stack.Screen name="scan/hasil" options={{ headerShown: true, title: "Hasil Identifikasi" }} />
      <Stack.Screen name="scan/rekomendasi" options={{ headerShown: true, title: "Rekomendasi Produk" }} />
      <Stack.Screen name="product/[id]" options={{ headerShown: true, title: "Detail Produk" }} />
    </Stack>
  );
}
```

Delete the temporary smoke screen:
```bash
rm app/index.tsx
```

- [ ] **Step 2: Tab layout**

Create `app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from "expo-router";
import { Home, History, BarChart3, User } from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#16a34a", headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "Beranda", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="riwayat" options={{ title: "Riwayat", tabBarIcon: ({ color, size }) => <History color={color} size={size} /> }} />
      <Tabs.Screen name="impact" options={{ title: "Impact", tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }} />
      <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Placeholder tab screens + onboarding**

Create `app/(tabs)/index.tsx`:
```tsx
import { View, Text } from "react-native";
export default function Beranda() {
  return <View className="flex-1 items-center justify-center"><Text>Beranda</Text></View>;
}
```

Create `app/(tabs)/riwayat.tsx`, `app/(tabs)/impact.tsx`, `app/(tabs)/profil.tsx` with the same shape (change the label text to `Riwayat`, `Impact`, `Profil` respectively).

Create `app/onboarding.tsx`:
```tsx
import { useState } from "react";
import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button } from "@/components/Button";

const SLIDES = [
  { title: "Foto Sampahmu", body: "Ambil foto sampah anorganik yang ingin kamu olah.", img: "https://placehold.co/300x300?text=Foto" },
  { title: "Dapat Ide Produk", body: "WASTEX memberi rekomendasi produk & tutorial visual.", img: "https://placehold.co/300x300?text=Ide" },
  { title: "Jual Produkmu", body: "Dapatkan estimasi harga dan materi promosi siap pakai.", img: "https://placehold.co/300x300?text=Jual" },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const router = useRouter();
  const finish = async () => {
    await AsyncStorage.setItem("wastex.onboarded", "1");
    router.replace("/(tabs)");
  };
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <View className="flex-1 bg-white items-center justify-center px-8 gap-4">
      <Image source={{ uri: slide.img }} className="w-56 h-56 rounded-2xl" />
      <Text className="text-2xl font-bold text-brand-dark text-center">{slide.title}</Text>
      <Text className="text-center text-gray-600">{slide.body}</Text>
      <View className="w-full gap-2 mt-4">
        <Button title={last ? "Mulai" : "Lanjut"} onPress={() => (last ? finish() : setI(i + 1))} />
        {!last ? <Button title="Lewati" variant="outline" onPress={finish} /> : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run and verify navigation**

Run: `npx expo start`
Expected: First launch shows onboarding; completing it lands on the 4-tab shell; tabs switch between Beranda/Riwayat/Impact/Profil.

- [ ] **Step 5: Commit**

```bash
git add app
git commit -m "feat: add tab navigation shell and onboarding gate"
```

---

## Task 12: Upload screen (real camera/gallery)

**Files:**
- Create: `app/scan/upload.tsx`
- Modify: `app/(tabs)/index.tsx` (add Scan button that routes to upload)

**Interfaces:**
- Consumes: `expo-image-picker`, `useScanSession` (Task 10), `Button` (Task 8).
- Produces: sets `photoUri` in session, navigates to `/scan/hasil`.

- [ ] **Step 1: Implement upload screen**

Create `app/scan/upload.tsx`:
```tsx
import { useState } from "react";
import { View, Image, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { useScanSession } from "@/store/scanSession";

export default function Upload() {
  const [uri, setUri] = useState<string | null>(null);
  const setPhoto = useScanSession((s) => s.setPhoto);
  const router = useRouter();

  const pick = async (from: "camera" | "library") => {
    const perm = from === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = from === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!res.canceled) setUri(res.assets[0].uri);
  };

  const analyze = () => {
    if (!uri) return;
    setPhoto(uri);
    router.push("/scan/hasil");
  };

  return (
    <View className="flex-1 bg-white p-5 gap-3">
      {uri ? (
        <Image source={{ uri }} className="w-full h-64 rounded-2xl" />
      ) : (
        <View className="w-full h-64 rounded-2xl bg-gray-100 items-center justify-center">
          <Text className="text-gray-400">Belum ada foto</Text>
        </View>
      )}
      <Button title="Ambil dari Kamera" onPress={() => pick("camera")} variant="outline" />
      <Button title="Pilih dari Galeri" onPress={() => pick("library")} variant="outline" />
      <Button title="Analisis" onPress={analyze} disabled={!uri} />
    </View>
  );
}
```

- [ ] **Step 2: Add Scan entry point on Home**

Overwrite `app/(tabs)/index.tsx`:
```tsx
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";

export default function Beranda() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <Header title="WASTEX" subtitle="Ubah sampah jadi produk bernilai jual" />
      <View className="px-5 gap-4">
        <Button title="Scan Sampah" onPress={() => router.push("/scan/upload")} />
        <Card>
          <Text className="font-semibold text-gray-900 mb-2">Cara Pakai</Text>
          <Text className="text-sm text-gray-600">1. Foto sampahmu</Text>
          <Text className="text-sm text-gray-600">2. Pilih rekomendasi produk</Text>
          <Text className="text-sm text-gray-600">3. Ikuti tutorial & jual produkmu</Text>
        </Card>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Verify manually**

Run: `npx expo start`
Expected: Home → "Scan Sampah" → Upload; picking a photo enables "Analisis"; tapping it navigates to Hasil (blank for now).

- [ ] **Step 4: Commit**

```bash
git add app/scan/upload.tsx "app/(tabs)/index.tsx"
git commit -m "feat: add upload screen with camera/gallery and home scan entry"
```

---

## Task 13: Result screen — scan call, RiskBadge, manual correction

**Files:**
- Create: `app/scan/hasil.tsx`

**Interfaces:**
- Consumes: `scanner` registry (Task 7), `useScanSession` (Task 10), `RiskBadge` (Task 9), `MockScanner` scenario is not needed here.
- Produces: sets `result` in session; navigates to `/scan/rekomendasi`. Shows manual-correction chooser when `confidence < 0.7`.

- [ ] **Step 1: Implement result screen**

Create `app/scan/hasil.tsx`:
```tsx
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { scanner } from "@/services";
import { useScanSession } from "@/store/scanSession";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { RiskBadge } from "@/features/RiskBadge";
import { MOCK_MATERIALS } from "@/mocks/materials"; // allowed ONLY here? NO — see step 2
import type { MaterialType, ScanResult } from "@/services/types";

export default function Hasil() {
  const { photoUri, result, setResult } = useScanSession();
  const [loading, setLoading] = useState(!result);
  const [showManual, setShowManual] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (result || !photoUri) return;
    scanner.scan(photoUri).then((r) => {
      setResult(r);
      setShowManual(r.confidence < 0.7);
      setLoading(false);
    });
  }, [photoUri]);

  if (loading || !result) return <LoadingSpinner message="Menganalisis material..." />;

  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <Card>
        <View className="flex-row justify-between items-center">
          <Text className="text-xl font-bold text-gray-900">{result.materialLabel}</Text>
          <RiskBadge level={result.riskLevel} />
        </View>
        <Text className="text-sm text-gray-500 mt-1">Kondisi: {result.condition}</Text>
        <Text className="text-xs text-gray-400 mt-1">Keyakinan: {Math.round(result.confidence * 100)}%</Text>
      </Card>

      {showManual ? (
        <View className="mt-4">
          <Text className="text-sm text-gray-600 mb-2">Kurang yakin dengan hasil? Pilih material yang benar:</Text>
          <ManualPicker onPick={(m) => { setResult(MOCK_MATERIALS[m]); setShowManual(false); }} />
        </View>
      ) : (
        <Pressable className="mt-3" onPress={() => setShowManual(true)}>
          <Text className="text-brand-dark text-sm">Bukan ini? Pilih manual</Text>
        </Pressable>
      )}

      <View className="mt-6">
        <Button title="Lihat Rekomendasi Produk" onPress={() => router.push("/scan/rekomendasi")} />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Move manual material data behind a service to respect the import rule**

The Global Constraints forbid screens importing `src/mocks`. Add a scanner helper instead. Append to `src/services/scanner/index.ts`:
```typescript
import type { MaterialType as MT } from "@/services/types";
import { MOCK_MATERIALS as _MM } from "@/mocks/materials";

export const MANUAL_MATERIALS: { type: MT; label: string }[] = [
  { type: "plastik_pet", label: "Botol Plastik PET" },
  { type: "kardus", label: "Kardus Bekas" },
  { type: "kaleng", label: "Kaleng Bekas" },
  { type: "kaca", label: "Botol Kaca" },
  { type: "sachet", label: "Kemasan Sachet" },
];

export function manualScanResult(type: MT) {
  return _MM[type];
}
```

Now update `app/scan/hasil.tsx`: remove the `import { MOCK_MATERIALS } ...` line and the inline `ManualPicker`, replacing with a compliant version:
```tsx
import { scanner } from "@/services";
import { MANUAL_MATERIALS, manualScanResult } from "@/services/scanner";
```
Replace the manual block usage of `MOCK_MATERIALS[m]` with `manualScanResult(m)`, and define `ManualPicker` at the bottom of the file:
```tsx
function ManualPicker({ onPick }: { onPick: (m: MaterialType) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {MANUAL_MATERIALS.map((m) => (
        <Pressable key={m.type} onPress={() => onPick(m.type)} className="border border-brand rounded-full px-3 py-2">
          <Text className="text-brand-dark text-sm">{m.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 3: Verify compile (import rule respected)**

Run: `npx tsc --noEmit`
Expected: No errors. Confirm `app/scan/hasil.tsx` no longer imports from `@/mocks`.

- [ ] **Step 4: Verify manually**

Run: `npx expo start`. Upload a photo → loading spinner ~2s → result card with risk badge. Tap "Bukan ini? Pilih manual" → material chips appear and selecting one updates the card.

- [ ] **Step 5: Commit**

```bash
git add app/scan/hasil.tsx src/services/scanner/index.ts
git commit -m "feat: add result screen with risk badge and manual correction"
```

---

## Task 14: Recommendation screen

**Files:**
- Create: `app/scan/rekomendasi.tsx`

**Interfaces:**
- Consumes: `recommendation` registry, `useScanSession`, `ProductCard` (Task 9), `EmptyState`, `LoadingSpinner`.
- Produces: selects a product into session; navigates to `/product/[id]`.

- [ ] **Step 1: Implement screen**

Create `app/scan/rekomendasi.tsx`:
```tsx
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { recommendation } from "@/services";
import { useScanSession } from "@/store/scanSession";
import { ProductCard } from "@/features/ProductCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import type { ProductRecommendation } from "@/services/types";

export default function Rekomendasi() {
  const { result, selectProduct } = useScanSession();
  const [items, setItems] = useState<ProductRecommendation[] | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!result) return;
    recommendation.getRecommendations(result).then(setItems);
  }, [result]);

  if (!items) return <LoadingSpinner message="Menyusun rekomendasi..." />;
  if (items.length === 0) return <EmptyState title="Belum ada rekomendasi" message="Coba material lain." />;

  return (
    <View className="flex-1 bg-gray-50 p-5">
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProductCard product={item} onPress={() => { selectProduct(item); router.push(`/product/${item.id}`); }} />
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `npx expo start`. From Hasil → "Lihat Rekomendasi Produk" → loading → list of product cards. Tapping a card navigates to product detail (blank for now).

- [ ] **Step 3: Commit**

```bash
git add app/scan/rekomendasi.tsx
git commit -m "feat: add product recommendation screen"
```

---

## Task 15: Product detail — 4 internal tabs + tutorial safety modal

**Files:**
- Create: `app/product/[id].tsx`

**Interfaces:**
- Consumes: `tutorial`, `pricing`, `selling`, `impact` registries; `useScanSession`; `TutorialStepCard`, `SafetyModal` (Task 9); `formatRupiah`.
- Produces: full product output UI; "Simpan ke Riwayat & Catat Impact" writes via `impact.saveProject`.

- [ ] **Step 1: Implement product detail with internal tab state**

Create `app/product/[id].tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { tutorial, pricing, selling, impact } from "@/services";
import { useScanSession } from "@/store/scanSession";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TutorialStepCard } from "@/features/TutorialStepCard";
import { SafetyModal } from "@/features/SafetyModal";
import { formatRupiah } from "@/lib/format";
import type { ProductTutorial, PricingEstimate, SellingKit } from "@/services/types";

type TabKey = "tutorial" | "preview" | "harga" | "jual";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { result, selectedProduct, photoUri, reset } = useScanSession();
  const router = useRouter();

  const [tab, setTab] = useState<TabKey>("tutorial");
  const [tut, setTut] = useState<ProductTutorial | null>(null);
  const [price, setPrice] = useState<PricingEstimate | null>(null);
  const [kit, setKit] = useState<SellingKit | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyAck, setSafetyAck] = useState(false);

  const risky = result?.riskLevel === "berisiko" || result?.riskLevel === "hati_hati";

  useEffect(() => {
    if (!id) return;
    tutorial.getTutorial(id).then(setTut);
    pricing.estimatePrice(id).then(setPrice);
    selling.getSellingKit(id).then(setKit);
  }, [id]);

  useEffect(() => {
    if (tab === "tutorial" && risky && !safetyAck) setSafetyOpen(true);
  }, [tab, risky, safetyAck]);

  const save = async () => {
    if (!result || !selectedProduct) return;
    await impact.saveProject({
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      material: result,
      product: selectedProduct,
      photoUri: photoUri ?? "",
    });
    reset();
    router.replace("/(tabs)");
  };

  if (!tut || !price || !kit) return <LoadingSpinner message="Menyiapkan panduan..." />;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row bg-white border-b border-gray-100">
        {(["tutorial", "preview", "harga", "jual"] as TabKey[]).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} className={`flex-1 py-3 items-center ${tab === k ? "border-b-2 border-brand" : ""}`}>
            <Text className={tab === k ? "text-brand-dark font-semibold" : "text-gray-500"}>
              {k === "tutorial" ? "Tutorial" : k === "preview" ? "Preview" : k === "harga" ? "Harga" : "Jual"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1 p-5">
        {tab === "tutorial" && (
          <View>
            <Text className="font-semibold text-gray-900 mb-2">Alat & Bahan</Text>
            {tut.toolsAndMaterials.map((t, i) => <Text key={i} className="text-sm text-gray-600">• {t}</Text>)}
            <View className="h-3" />
            {tut.steps.map((s) => <TutorialStepCard key={s.order} step={s} />)}
          </View>
        )}
        {tab === "preview" && (
          <View className="gap-3">
            <Text className="font-semibold text-gray-900">Before</Text>
            <Image source={{ uri: tut.beforeImageUri }} className="w-full h-48 rounded-2xl" />
            <Text className="font-semibold text-gray-900">After</Text>
            <Image source={{ uri: tut.afterImageUri }} className="w-full h-48 rounded-2xl" />
            <Text className="font-semibold text-gray-900">Mockup Produk</Text>
            <Image source={{ uri: tut.mockupImageUri }} className="w-full h-48 rounded-2xl" />
          </View>
        )}
        {tab === "harga" && (
          <Card>
            <Row label="Modal Bahan" value={formatRupiah(price.materialCost)} />
            <Row label="Bahan Tambahan" value={formatRupiah(price.additionalCost)} />
            <Row label="Harga Jual" value={formatRupiah(price.suggestedSellPrice)} />
            <Row label="Perkiraan Untung" value={formatRupiah(price.estimatedProfit)} />
            <Text className="text-xs text-gray-500 mt-2">Rentang pasar: {formatRupiah(price.priceRangeLow)}–{formatRupiah(price.priceRangeHigh)}</Text>
            <Text className="text-xs text-gray-400 mt-1">{price.notes}</Text>
          </Card>
        )}
        {tab === "jual" && (
          <View className="gap-2">
            <Text className="font-bold text-gray-900">{kit.productName}</Text>
            <Text className="text-sm text-gray-600">{kit.description}</Text>
            <Text className="font-semibold text-gray-900 mt-2">Caption Promosi</Text>
            {kit.captions.map((c, i) => <Text key={i} className="text-sm text-gray-600">• {c}</Text>)}
            <Text className="font-semibold text-gray-900 mt-2">Saran Foto</Text>
            {kit.photoTips.map((c, i) => <Text key={i} className="text-sm text-gray-600">• {c}</Text>)}
            <Text className="font-semibold text-gray-900 mt-2">Ide Kemasan</Text>
            {kit.packagingIdeas.map((c, i) => <Text key={i} className="text-sm text-gray-600">• {c}</Text>)}
          </View>
        )}
        <View className="h-4" />
        <Button title="Simpan ke Riwayat & Catat Impact" onPress={save} />
        <View className="h-8" />
      </ScrollView>

      <SafetyModal
        visible={safetyOpen}
        notes={result?.safetyNotes ?? []}
        onConfirm={() => { setSafetyAck(true); setSafetyOpen(false); }}
        onCancel={() => { setSafetyOpen(false); setTab("preview"); }}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-gray-600">{label}</Text>
      <Text className="text-gray-900 font-semibold">{value}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify manually (all 4 tabs + safety modal)**

Run: `npx expo start`. Select a `kaca` product (force via a `kaca` recommendation) → opening the Tutorial tab pops the SafetyModal → "Saya Mengerti" dismisses it. Check Preview/Harga/Jual tabs render. Tap "Simpan..." → returns to Home.

- [ ] **Step 3: Commit**

```bash
git add app/product/[id].tsx
git commit -m "feat: add product detail with 4 tabs, safety modal, and save-to-impact"
```

---

## Task 16: History + Impact screens

**Files:**
- Create: `src/store/useImpact.ts`
- Overwrite: `app/(tabs)/riwayat.tsx`, `app/(tabs)/impact.tsx`

**Interfaces:**
- Consumes: `impact` registry; `Card`, `EmptyState`, `LoadingSpinner`; `formatRupiah`.
- Produces: `useImpactData()` hook returning `{ history, summary, refresh, remove }`.

- [ ] **Step 1: Implement the impact hook**

Create `src/store/useImpact.ts`:
```typescript
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { impact } from "@/services";
import type { ImpactSummary, SavedProject } from "@/services/types";

export function useImpactData() {
  const [history, setHistory] = useState<SavedProject[] | null>(null);
  const [summary, setSummary] = useState<ImpactSummary | null>(null);

  const refresh = useCallback(async () => {
    setHistory(await impact.getHistory());
    setSummary(await impact.getImpactSummary());
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await impact.deleteProject(id);
    await refresh();
  }, [refresh]);

  return { history, summary, refresh, remove };
}
```

- [ ] **Step 2: Implement Riwayat screen**

Overwrite `app/(tabs)/riwayat.tsx`:
```tsx
import { FlatList, View, Text, Pressable } from "react-native";
import { useImpactData } from "@/store/useImpact";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function Riwayat() {
  const { history, remove } = useImpactData();
  if (!history) return <LoadingSpinner />;
  if (history.length === 0) return <EmptyState title="Belum ada riwayat" message="Mulai scan sampah pertamamu!" />;

  return (
    <View className="flex-1 bg-gray-50 p-5">
      <FlatList
        data={history}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View className="mb-3">
            <Card>
              <Text className="font-bold text-gray-900">{item.product.name}</Text>
              <Text className="text-sm text-gray-500">{item.material.materialLabel}</Text>
              <Text className="text-xs text-gray-400 mt-1">{new Date(item.savedAt).toLocaleDateString("id-ID")}</Text>
              <Pressable onPress={() => remove(item.id)} className="mt-2">
                <Text className="text-risk-bahaya text-xs">Hapus</Text>
              </Pressable>
            </Card>
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 3: Implement Impact screen**

Overwrite `app/(tabs)/impact.tsx`:
```tsx
import { View, Text, ScrollView } from "react-native";
import { useImpactData } from "@/store/useImpact";
import { Card } from "@/components/Card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { formatRupiah } from "@/lib/format";

export default function Impact() {
  const { summary } = useImpactData();
  if (!summary) return <LoadingSpinner />;
  return (
    <ScrollView className="flex-1 bg-gray-50 p-5">
      <View className="gap-4">
        <Metric label="Sampah Diolah" value={`${summary.totalWasteProcessed} item`} />
        <Metric label="Produk Dibuat" value={`${summary.totalProductsMade} produk`} />
        <Metric label="Estimasi Nilai Ekonomi" value={formatRupiah(summary.estimatedEconomicValue)} />
      </View>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-3xl font-bold text-brand-dark mt-1">{value}</Text>
    </Card>
  );
}
```

- [ ] **Step 4: Verify manually**

Run: `npx expo start`. After saving a project (Task 15), open Riwayat (item appears) and Impact (metrics reflect the save). Delete from Riwayat → Impact updates on focus.

- [ ] **Step 5: Commit**

```bash
git add src/store/useImpact.ts "app/(tabs)/riwayat.tsx" "app/(tabs)/impact.tsx"
git commit -m "feat: add history and impact tracker screens"
```

---

## Task 17: Profile screen + clear data

**Files:**
- Overwrite: `app/(tabs)/profil.tsx`

**Interfaces:**
- Consumes: `impact` registry; `Button`, `Card`, `Header`; AsyncStorage (reset onboarding optional).
- Produces: privacy "hapus semua data" action.

- [ ] **Step 1: Implement profile screen**

Overwrite `app/(tabs)/profil.tsx`:
```tsx
import { View, Text, Alert, ScrollView } from "react-native";
import { impact } from "@/services";
import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function Profil() {
  const clearData = () => {
    Alert.alert("Hapus Semua Data", "Riwayat dan catatan impact akan dihapus permanen. Lanjutkan?", [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => { await impact.clearAll(); Alert.alert("Data dihapus"); } },
    ]);
  };
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <Header title="Profil" subtitle="Pengguna WASTEX" />
      <View className="px-5 gap-4">
        <Card>
          <Text className="font-semibold text-gray-900">Pengguna Demo</Text>
          <Text className="text-sm text-gray-500">demo@wastex.id</Text>
        </Card>
        <Card>
          <Text className="font-semibold text-gray-900 mb-2">Privasi & Data</Text>
          <Text className="text-xs text-gray-500 mb-3">
            Fotomu hanya disimpan di perangkat untuk riwayat. Kamu dapat menghapusnya kapan saja.
          </Text>
          <Button title="Hapus Semua Data" variant="outline" onPress={clearData} />
        </Card>
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `npx expo start`. Profil → "Hapus Semua Data" → confirm → Riwayat/Impact become empty.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/profil.tsx"
git commit -m "feat: add profile screen with clear-data privacy action"
```

---

## Task 18: Polish pass — loading/empty consistency, lint, full test run

**Files:**
- Modify: any screen missing a loading/empty state (audit).
- Create: `.eslintrc.js` if not present (Expo default).

**Interfaces:**
- Consumes: everything.
- Produces: consistent UX; green lint + tests.

- [ ] **Step 1: Audit every service call for loading + empty handling**

Check each of `hasil.tsx`, `rekomendasi.tsx`, `product/[id].tsx`, `riwayat.tsx`, `impact.tsx`. Confirm each shows `LoadingSpinner` while awaiting and `EmptyState` where a list can be empty. Fix any gaps found.

- [ ] **Step 2: Run lint**

Run: `npx expo lint`
Expected: No errors. Fix any reported issues.

- [ ] **Step 3: Run the full test suite + type check**

Run: `npm test && npx tsc --noEmit`
Expected: All suites PASS; no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: polish loading/empty states, lint and type-check clean"
```

---

## Task 19: EAS internal build (APK) + screenshots

**Files:**
- Create: `eas.json`

**Interfaces:**
- Consumes: the whole app.
- Produces: installable Android APK; 10 screenshots for the proposal.

- [ ] **Step 1: Configure EAS for an internal APK**

Run:
```bash
npm install -g eas-cli
eas login
eas build:configure
```

Create/adjust `eas.json` so the preview profile emits an APK:
```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" },
      "distribution": "internal"
    },
    "production": {}
  }
}
```

- [ ] **Step 2: Build the APK**

Run: `eas build -p android --profile preview`
Expected: Build succeeds; EAS returns a downloadable `.apk` URL.

- [ ] **Step 3: Install and smoke-test on a device**

Download the APK, install on an Android phone, and walk the full flow: onboarding → scan → hasil → rekomendasi → detail (4 tabs) → save → Riwayat/Impact → Profil clear-data.
Expected: No crashes; all screens function with mock data.

- [ ] **Step 4: Capture the 10 proposal screenshots**

Capture: Beranda, Upload, Hasil Identifikasi, Rekomendasi, Tutorial, Before-After Preview, Product Mockup, Estimasi Harga, AI Selling Assistant, Impact Tracker. Save under `assets/screenshots/` (Gambar 8–17).

- [ ] **Step 5: Commit**

```bash
git add eas.json assets/screenshots
git commit -m "chore: add EAS preview APK config and proposal screenshots"
```

---

## Self-Review

**1. Spec coverage:**
- 13 screens: onboarding (T11), Beranda (T12), Riwayat + Impact (T16), Profil (T17), Upload (T12), Hasil + manual correction (T13), Rekomendasi (T14), Product detail 4 tabs (T15) — all covered.
- 6 services + contract + registry: T3 (types), T5 (scanner), T6 (rec/tutorial/pricing/selling), T7 (impact + registry) — covered.
- Service Layer + Mock Adapter with single `USE_MOCK` switch: T7 — covered.
- Mock delay simulation: T5 `mockDelay` used by all services — covered.
- Confidence <0.7 → manual correction: T13 — covered.
- Safety-first (RiskBadge + SafetyModal): T9 (components), T13 (badge on result), T15 (modal before risky tutorial) — covered.
- History + Impact via AsyncStorage: T7, T16 — covered.
- Clear data (privacy): T17 — covered.
- Screens never import `src/mocks`: enforced, with the T13 correction moving manual data behind `src/services/scanner`.
- APK + screenshots: T19 — covered.

**2. Placeholder scan:** No "TBD/TODO"; every code step contains complete code. The one repeated tab-screen shape in T11 Step 3 gives the full component and states the one-word label change — acceptable and unambiguous.

**3. Type consistency:** Method names match the contracts in T3 (`scan`, `getRecommendations`, `getTutorial`, `estimatePrice`, `getSellingKit`, `saveProject`/`getHistory`/`getImpactSummary`/`deleteProject`/`clearAll`). Registry export names (`scanner`, `recommendation`, `tutorial`, `pricing`, `selling`, `impact`) match all screen imports. `MaterialType`, `RiskLevel`, `Difficulty` literals used consistently.

**Fix applied inline:** T13 originally imported `@/mocks/materials` in a screen (violating the import rule); replaced with `MANUAL_MATERIALS`/`manualScanResult` exported from `src/services/scanner`.

---

## Notes for the AI Phase (out of scope here)

When the AI phase begins: implement `ApiScanner`, `ApiRecommendation`, `ApiTutorial`, `ApiPricing`, `ApiSelling` returning the same contract types, set `USE_MOCK = false` in `src/services/index.ts`, and point `impact` at the backend if desired. No screen changes required.
