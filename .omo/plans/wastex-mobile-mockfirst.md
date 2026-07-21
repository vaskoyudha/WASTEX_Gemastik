# wastex-mobile-mockfirst - Work Plan

## TL;DR (For humans)

**What you'll get:** A complete, installable Android app for WASTEX where every screen works — you photograph trash, see an identified material with a safety rating, browse product ideas, follow a visual tutorial, view price estimates and selling copy, save the result, and watch your impact stats grow. The "AI" answers are realistic stand-ins for now, wired so the real AI can drop in later without touching any screen.

**Why this approach:** One clean seam between the app and the "AI" (a single on/off switch) means the two mobile developers build the entire experience now, and the AI teammate plugs in real intelligence later with zero screen rework. History and stats are saved on the phone so demos feel real.

**What it will NOT do:** No real AI, no server or login, no online marketplace — those come in a later phase.

**Effort:** Large (about 6 weeks, 21 work items, ~2 mobile devs + 1 preparing AI in parallel)
**Risk:** Low–Medium — the main risks are getting the NativeWind styling setup right and keeping the app/mock boundary clean, both of which the plan pins down and tests.
**Decisions to sanity-check:** (1) The Impact "economic value" temporarily uses product *cost* as a stand-in; (2) simple bar chart and a recent-history shortcut were added because your approved design asks for them; (3) all 6 materials (incl. HDPE) are selectable in manual correction.

Your next move: approve to hand off for execution (via `$start-work`), or ask me to run an optional high-accuracy review first. Full execution detail follows below.

---

> TL;DR (machine): Large / Low-Med risk. Deliverable: Expo+NativeWind mock-first WASTEX app, 13 screens, 6 mock services behind USE_MOCK, AsyncStorage persistence, APK + 10 screenshots. 21 todos across 7 waves.

## Scope
### Must have
- Expo (React Native) + TypeScript + NativeWind v4 project that boots to a styled screen.
- `src/services/types.ts` with 6 frozen service contracts (Scanner, Recommendation, Tutorial, Pricing, Selling, Impact).
- 6 mock service implementations behind a single `USE_MOCK` registry switch, each simulating 1.5–2.5s delay.
- `LocalImpactService` persisting history + impact to AsyncStorage, with corrupt-data recovery.
- Design system: base components (Button, Card, Badge, Header, LoadingSpinner, EmptyState) + feature components (RiskBadge, ProductCard, TutorialStepCard, SafetyModal) + an error state.
- 13 screens: onboarding (3-slide), Beranda (with recent-history shortcut), Riwayat (re-openable items), Impact (numbers + simple chart), Profil (clear-data), Upload, Hasil (risk badge + manual correction for all 6 materials), Rekomendasi, Product detail (4 internal tabs + safety modal).
- Expo Router navigation: tab bar + scan stack + onboarding gate + `typedRoutes`.
- Defined scan-session lifecycle (born on Upload mount, dies on save or Upload re-mount).
- Error handling on every service call (retry affordance), enforced no-`src/mocks`-import boundary (ESLint + test).
- EAS preview APK (Android) + 10 proposal screenshots mapped to Gambar 8–17.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- NO real Vision AI, LLM (DeepSeek-V3), image generation, Multimodal-RAG, Self-Expanding Skill Library, or expert dashboard.
- NO backend (FastAPI), real authentication, Supabase DB/Storage, or Railway deployment.
- NO favorites, social share, push notifications, complex gamification/badges, multi-language, or 👍/👎 feedback, or "Jelajahi Ide" browse screen (spec §6 deferred list).
- NO reduction of the 13 screens to an "MVP subset" — full scope is mandatory.
- NO screen may import from `src/mocks` — screens consume data only through `src/services`.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: **TDD for pure logic** (formatters, mock services, LocalImpactService, stores, pure components) + **tests-after for screens** using `@testing-library/react-native` render/interaction assertions (every screen todo T12–T19 ships a `npm test -- <screen>` command in its acceptance criteria — no `manual:` gating). Framework: **Jest + jest-expo** (configured in T1, incl. reanimated mock + broad transformIgnorePatterns).
- Type gate: `npx tsc --noEmit` clean after every code todo.
- Lint gate: `npx expo lint` clean; plus architecture rule blocking `app/** -> src/mocks/**` (T20).
- Evidence: `.omo/evidence/task-<N>-wastex-mobile-mockfirst.txt` (test/lint/tsc output captured per todo; outside ulw-loop use `.omo/evidence/`).

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

- **Wave 1 — Foundation:** T1 (scaffold), T2 (types contract). T2 depends on T1's `src/` structure.
- **Wave 2 — Primitives (parallel):** T3 (theme+format), T4 (mock data), T8 (base components). All depend only on T1/T2.
- **Wave 3 — Services & state (parallel):** T5 (delay+scanner+MANUAL_MATERIALS), T6 (rec/tutorial/pricing/selling), T7 (impact+registry), T10 (useServiceCall hook), T11 (scan-session store+lifecycle).
- **Wave 4 — Composition (parallel):** T9 (feature components), T12 (navigation shell + onboarding gate + typedRoutes).
- **Wave 5 — Scan flow (parallel where noted):** T13 (upload + permission UX), T14 (Beranda + recent history), T15 (hasil + manual correction), T16 (rekomendasi).
- **Wave 6 — Detail & tabs (parallel):** T17 (product detail 4 tabs + safety modal), T18 (history+impact+chart), T19 (profil + clear data).
- **Wave 7 — Hardening & release:** T20 (arch-lint + error/empty audit + integration tests + lint/tsc), T21 (EAS APK + screenshots).

### Owner assignment (Vasco / Kiral / Falih)
> Rule: work per wave; a task in the same wave can be built in parallel. Do NOT start a task until every task in its "Blocked by" list is merged to main. 1 task = 1 branch = 1 PR (reviewed by ≥1 teammate) = merge.

| Owner | Lane | Owns todos | Load |
| --- | --- | --- | --- |
| **Vasco** | Backbone — data contract, mock content, scanner, + AI-prep | T1, T2, T4, T5, T6 (+ AI knowledge-base prep in Waves 4–6, + help capture screenshots in T21) | 5 todos + parallel AI-prep |
| **Kiral** | App shell & scan flow | T8, T10, T11, T12, T13, T15, T17, T21 | 8 todos |
| **Falih** | Persistence, remaining screens & QA | T3, T7, T9, T14, T16, T18, T19, T20 | 8 todos |

**Per-wave view (who works when):**

| Wave | Vasco | Kiral | Falih |
| --- | --- | --- | --- |
| 1 | T1 → T2 (solo; team reviews T2 then freezes it) | — (prep) | — (prep) |
| 2 | T4 | T8 | T3 |
| 3 | T5, T6 | T10, T11 | T7 |
| 4 | AI-prep | T12 | T9 |
| 5 | AI-prep | T13, T15 | T14, T16 |
| 6 | AI-prep | T17 | T18, T19 |
| 7 | help screenshots (T21) | T21 (build APK) | T20 (lead QA) |

Wave 1 is the only real bottleneck: Vasco builds T1 then T2, everyone reviews T2 (`src/services/types.ts`, the shared "data contract") and freezes it. Once T2 is merged, all three work in parallel every wave after.

### Dependency matrix
> `Blocks` is the exact inverse of `Blocked by` (direct edges only). Within a wave, the listed tasks have no mutual `Blocks` edge and run in parallel; the two ordered pairs Wave 1 (T1→T2) and Wave 7 (T20→T21) execute in sequence. `Blocked by` is authoritative for scheduling.

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | — | 2,3,8,10,12 | — |
| 2 | 1 | 3,4,5,6,7,11 | 8 |
| 3 | 1,2 | 9 | 4,8 |
| 4 | 2 | 5,6 | 3,8 |
| 5 | 2,4 | 15 | 6,7,10,11 |
| 6 | 2,4 | 16,17 | 5,7,10,11 |
| 7 | 2 | 14,17,18,19 | 5,6,10,11 |
| 8 | 1 | 9,12 | 2,3,4 |
| 9 | 3,8 | 15,16,17 | 10,11,12 |
| 10 | 1 | 13,15,16,17,18 | 5,6,7,9,11 |
| 11 | 2 | 13,15,16,17 | 5,6,7,9,10 |
| 12 | 1,8 | 13,14,15,16 | 9 |
| 13 | 10,11,12 | 20 | 14,16 |
| 14 | 7,12 | 20 | 13,15,16 |
| 15 | 5,9,10,11,12 | 20 | 14 |
| 16 | 6,9,10,11,12 | 20 | 13,14 |
| 17 | 6,7,9,10,11 | 20 | 18,19 |
| 18 | 7,10 | 20 | 17,19 |
| 19 | 7 | 20 | 17,18 |
| 20 | 13,14,15,16,17,18,19 | 21 | — |
| 21 | 20 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Scaffold Expo + TypeScript + NativeWind v4 + Expo Router + Jest
  What to do / Must NOT do: `npx create-expo-app@latest wastex-mobile` (TS + Expo Router template). Install runtime: `nativewind@4.x` (exact), `tailwindcss@^3.4.17` (PIN v3 — NativeWind v4 is incompatible with Tailwind v4, Oracle-2), `react-native-reanimated react-native-safe-area-context zustand @react-native-async-storage/async-storage lucide-react-native react-native-svg`; `npx expo install expo-image-picker`. Dev: `jest jest-expo @testing-library/react-native @testing-library/jest-native`. Create `tailwind.config.js` (preset `nativewind/preset`, brand color `#16a34a`/dark `#15803d`/light `#dcfce7`, risk aman `#16a34a`/hati `#d97706`/bahaya `#dc2626`), `global.css` (3 @tailwind directives), `babel.config.js` = `presets: [["babel-preset-expo",{jsxImportSource:"nativewind"}], "nativewind/babel"]` (nativewind/babel goes in PRESETS not plugins — Oracle-5; add `react-native-reanimated/plugin` LAST in plugins), `metro.config.js` (`withNativeWind(config,{input:"./global.css"})`), `nativewind-env.d.ts`. `tsconfig.json`: strict + `@/*`→`./src/*` + `"nativewind/types"` + KEEP `.expo/types/**/*.ts` in include. Enable typed routes in `app.json` under `expo.experiments.typedRoutes: true` (NOT tsconfig — Oracle-1). Create `jest.config.js` NOW (preset jest-expo; setup `@testing-library/jest-native/extend-expect` + `require("react-native-reanimated").setUpTests?.()` reanimated mock; `transformIgnorePatterns` covering `react-native`, `@react-native`, `expo`, `nativewind`, `react-native-css`, `react-native-reanimated`, `react-native-svg`, `lucide-react-native`) and add `"test":"jest"` to package.json (Oracle-3: jest must exist before any TDD todo). Root `app/_layout.tsx` imports `global.css`; temp `app/index.tsx` renders styled "WASTEX". Must NOT add AI/backend deps; must NOT install Tailwind v4.
  Parallelization: Wave 1 | Owner: Vasco | Blocked by: — | Blocks: 2,3,8,10,12
  References: spec §3.2 (stack), §3.3 (folders); NativeWind v4 install docs (tailwindcss@^3.4.17, preset, babel presets, metro, nativewind-env.d.ts); Expo Router typed-routes docs (app.json experiments); Oracle-1,2,3,5,6.
  Acceptance criteria (agent-executable): `npx tsc --noEmit` exits 0; `npm test` runs jest and reports 0 tests without config error; `npx expo start` boots without Metro error; `node -e "require('tailwindcss/package.json').version.startsWith('3')||process.exit(1)"` exits 0 (Tailwind v3 pinned); smoke screen shows green bold "WASTEX" on light-green bg.
  QA scenarios: happy — start Metro, confirm styled render (screenshot to evidence); `npm test` exits 0 with jest configured. failure — temporarily install `tailwindcss@4`, confirm NativeWind build/style breaks, revert to `^3.4.17`. Evidence `.omo/evidence/task-1-wastex-mobile-mockfirst.txt`
  Commit: Y | chore(mobile): scaffold Expo + NativeWind v4 (Tailwind v3) + Expo Router + Jest

- [ ] 2. Define frozen service contracts `src/services/types.ts`
  What to do / Must NOT do: Create `src/services/types.ts` with enums `MaterialType` (6: plastik_pet, plastik_hdpe, kardus, kaleng, kaca, sachet), `RiskLevel` (aman, hati_hati, berisiko), `Difficulty` (mudah, sedang, sulit); interfaces `ScanResult`, `WasteScannerService`, `ProductRecommendation`, `RecommendationService`, `TutorialStep`, `ProductTutorial`, `TutorialService`, `PricingEstimate`, `PricingService`, `SellingKit`, `SellingAssistantService`, `SavedProject`, `ImpactSummary`, `ImpactService`. Field names verbatim from spec §4. Must NOT add methods beyond spec; this file is frozen after this todo.
  Parallelization: Wave 1 | Owner: Vasco | Blocked by: 1 | Blocks: 3,4,5,6,7,11 | Parallel: 8
  References: spec §4.1–§4.7 (full type definitions).
  Acceptance criteria (agent-executable): `npx tsc --noEmit` exits 0; grep confirms all 6 material literals present.
  QA scenarios: happy — tsc clean. failure — write a scratch file assigning an invalid `materialType`, confirm tsc errors, delete scratch. Evidence `.omo/evidence/task-2-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(services): define frozen service data contracts

- [ ] 3. Theme tokens + Rupiah formatter (TDD)
  What to do / Must NOT do: (Jest already configured in T1.) TDD `src/lib/format.ts` `formatRupiah(n)` → "Rp 15.000" (id-ID grouping); `src/lib/theme.ts` `RISK_META` (aman→{label:"Aman",color:"#16a34a"}, hati_hati→{"Hati-hati","#d97706"}, berisiko→{"Berisiko","#dc2626"}) and `DIFFICULTY_META` (mudah/sedang/sulit → labels). Must NOT redefine colors elsewhere.
  Parallelization: Wave 2 | Owner: Falih | Blocked by: 1,2 | Blocks: 9 | Parallel: 4,8
  References: spec §3.3 (lib), §4.1 (enums); prior plan T2.
  Acceptance criteria (agent-executable): `npm test -- format` PASS (Rp 0, Rp 15.000, Rp 1.250.000); `npx tsc --noEmit` clean.
  QA scenarios: happy — 3 formatRupiah assertions pass. failure — assert `formatRupiah(15000)==="15000"`, confirm FAIL, fix expectation. Evidence `.omo/evidence/task-3-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(lib): add Rupiah formatter and theme tokens with tests

- [ ] 4. Mock data sets for all 6 materials (TDD-light)
  What to do / Must NOT do: Create `src/mocks/{materials,products,tutorials,pricing,selling}.ts`. `MOCK_MATERIALS: Record<MaterialType,ScanResult>` — ALL 6 materials; kaca=berisiko with safetyNotes, kaleng=hati_hati, sachet confidence 0.64. `MOCK_PRODUCTS: Record<MaterialType,ProductRecommendation[]>` — kaca & plastik_pet get 3 products, other 4 get ≥1. Tutorials/pricing/selling fully populate kaca-vas & pet-pot; others rely on service fallbacks (T6). Images use `https://placehold.co/...`; ALSO add local `assets/placeholders/{kaca,pet}.png` require-able for the 2 hero flows (offline demo safety per Metis U4). Must NOT let screens import these.
  Parallelization: Wave 2 | Owner: Vasco | Blocked by: 2 | Blocks: 5,6 | Parallel: 3,8
  References: spec §4.2–§4.6; Metis U4 (offline images).
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; test asserts `Object.keys(MOCK_MATERIALS).length===6` and every `MaterialType` key present in MOCK_PRODUCTS.
  QA scenarios: happy — key-coverage test passes. failure — remove `plastik_hdpe` from MOCK_MATERIALS, confirm test FAILS, restore. Evidence `.omo/evidence/task-4-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(mocks): add mock data for 6 materials, products, tutorials, pricing, selling

- [ ] 5. Delay helper + MockScanner + MANUAL_MATERIALS (TDD)
  What to do / Must NOT do: `src/services/delay.ts` `mockDelay(min=1500,max=2500)`. `src/services/scanner/index.ts`: `MockScanner implements WasteScannerService` (ctor optional delayMs for tests), `setMockScenario(m|'low_confidence'|null)`, and export `MANUAL_MATERIALS` (ALL 6 materials incl. plastik_hdpe — Metis M1) + `manualScanResult(type)`. low_confidence returns confidence<0.7. Must NOT let screens read mocks except via these exports.
  Parallelization: Wave 3 | Owner: Vasco | Blocked by: 2,4 | Blocks: 15 | Parallel: 6,7,10,11
  References: spec §4.2; Metis M1 (6 materials), C1 (manual data behind service).
  Acceptance criteria (agent-executable): `npm test -- scanner` PASS: valid ScanResult; forced "kaca" → riskLevel "berisiko"; "low_confidence" → confidence<0.7; `MANUAL_MATERIALS.length===6`.
  QA scenarios: happy — 4 assertions pass with delayMs=0. failure — assert MANUAL_MATERIALS length 5, confirm FAIL, fix to 6. Evidence `.omo/evidence/task-5-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(services): add MockScanner, scenario control, and 6-material manual list

- [ ] 6. Recommendation/Tutorial/Pricing/Selling mock services (TDD)
  What to do / Must NOT do: Create `src/services/{recommendation,tutorial,pricing,selling}/index.ts`, each `implements` its interface, ctor optional delayMs, uses `mockDelay`, reads its mock map, returns a typed FALLBACK for unknown ids (so all 6 materials demo end-to-end). Must NOT throw on unknown id.
  Parallelization: Wave 3 | Owner: Vasco | Blocked by: 2,4 | Blocks: 16,17 | Parallel: 5,7,10,11
  References: spec §4.3–§4.6; Metis U-fallbacks (thin data for 4 materials).
  Acceptance criteria (agent-executable): `npm test -- services` PASS: rec for kaca returns ≥1 with id containing "kaca"; tutorial steps ordered from 1; pricing suggestedSellPrice>materialCost; selling captions.length>0; unknown id returns fallback (not throw).
  QA scenarios: happy — 5 assertions pass. failure — make tutorial throw on unknown id, confirm fallback test FAILS, restore fallback. Evidence `.omo/evidence/task-6-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(services): add recommendation, tutorial, pricing, selling mock services

- [ ] 7. LocalImpactService (AsyncStorage, corrupt-safe) + registry (TDD)
  What to do / Must NOT do: `src/services/impact/index.ts` `LocalImpactService` key `wastex.history.v1`; `readAll` wraps `JSON.parse` in try/catch → returns [] on corrupt (Metis M4). Implement save/getHistory/getImpactSummary/deleteProject/clearAll. `clearAll` MUST `AsyncStorage.removeItem("wastex.history.v1")` only — NOT `AsyncStorage.clear()` (must not wipe `wastex.onboarded`, Oracle-7). `estimatedEconomicValue` = sum of `product.estimatedCost` with a code comment flagging AI-phase swap to suggestedSellPrice (Metis C3). `src/services/index.ts` registry: `export const USE_MOCK=true` and `scanner/recommendation/tutorial/pricing/selling/impact` bound to Mock*/Local*. Must NOT import Api* (not built this phase).
  Parallelization: Wave 3 | Owner: Falih | Blocked by: 2 | Blocks: 14,17,18,19 | Parallel: 5,6,10,11
  References: spec §4.7, §4.8; Metis M4 (corrupt), C3 (economic value); Oracle-7 (scoped clearAll).
  Acceptance criteria (agent-executable): `npm test -- impact` PASS: save→getHistory len 1; summary totals; clearAll empties; corrupt string (`setItem` raw "{bad") → getHistory returns [] not throw. `npx tsc --noEmit` clean.
  QA scenarios: happy — 4 assertions pass (AsyncStorage jest mock). failure — remove try/catch, confirm corrupt-data test FAILS, restore. Evidence `.omo/evidence/task-7-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(services): add corrupt-safe LocalImpactService and USE_MOCK registry

- [ ] 8. Base UI components (TDD-light)
  What to do / Must NOT do: `src/components/{Button,Card,Badge,Header,LoadingSpinner,EmptyState}.tsx` with NativeWind classes. Button primary/outline + disabled. Test Badge renders label.
  Parallelization: Wave 2 | Owner: Kiral | Blocked by: 1 | Blocks: 9,12 | Parallel: 2,3,4
  References: spec §3.3; prior plan T8.
  Acceptance criteria (agent-executable): `npm test -- Badge` PASS (renders "Aman"); `npx tsc --noEmit` clean.
  QA scenarios: happy — Badge render test passes. failure — assert wrong label text, confirm FAIL, fix. Evidence `.omo/evidence/task-8-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(ui): add base components (Button, Card, Badge, Header, LoadingSpinner, EmptyState)

- [ ] 9. Feature components — RiskBadge, ProductCard, TutorialStepCard, SafetyModal (TDD-light)
  What to do / Must NOT do: `src/features/{RiskBadge,ProductCard,TutorialStepCard,SafetyModal}.tsx`. RiskBadge maps RiskLevel→RISK_META label/color. ProductCard shows name, difficulty label, formatRupiah(cost), minutes. TutorialStepCard shows numbered step + optional safetyWarning. SafetyModal: title, notes list, APD note, Lanjutkan/Kembali buttons.
  Parallelization: Wave 4 | Owner: Falih | Blocked by: 3,8 | Blocks: 15,16,17 | Parallel: 10,11,12
  References: spec §5.2, §6 (safety-first); Metis A4 (safety trigger).
  Acceptance criteria (agent-executable): `npm test -- RiskBadge` PASS (level "berisiko" → "Berisiko"); `npx tsc --noEmit` clean.
  QA scenarios: happy — RiskBadge label test passes. failure — map berisiko to wrong label, confirm FAIL, fix. Evidence `.omo/evidence/task-9-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(features): add RiskBadge, ProductCard, TutorialStepCard, SafetyModal

- [ ] 10. `useServiceCall` hook for loading/error/data (TDD) [Metis M2, A1]
  What to do / Must NOT do: `src/lib/useServiceCall.ts` generic hook `useServiceCall<T>(fn: ()=>Promise<T>, deps)` returning `{data,loading,error,retry}`; wraps call in try/catch, exposes retry that re-invokes. Every screen service call MUST use this. Must NOT swallow errors silently.
  Parallelization: Wave 3 | Owner: Kiral | Blocked by: 1 | Blocks: 13,15,16,17,18 | Parallel: 5,6,7,9,11
  References: Metis M2 (no error handling), A1 (error AC).
  Acceptance criteria (agent-executable): `npm test -- useServiceCall` PASS: resolves→data set/loading false/error null; rejects→error set/loading false; retry re-runs and clears error.
  QA scenarios: happy — resolve path test passes. failure — a rejecting fn leaves error null (before impl), confirm FAIL, implement catch. Evidence `.omo/evidence/task-10-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(lib): add useServiceCall hook with error + retry

- [ ] 11. Scan-session store + lifecycle contract (TDD) [Metis M3, A2]
  What to do / Must NOT do: `src/store/scanSession.ts` Zustand: `photoUri,result,selectedProduct,safetyAckProductIds:string[]` + `setPhoto,setResult,selectProduct,ackSafety(id),reset`. Lifecycle contract (documented in file header + enforced by consumers): session is BORN/RESET at **scan-initiation** — call `reset()` when the Upload screen mounts AND at the start of `setPhoto` (so backing to a still-mounted Upload and re-analyzing also clears stale state; a native-stack back does not remount, Oracle-8). Session DIES on save(). `safetyAckProductIds` persists ack across remount within a session (Metis A4). Must NOT keep safetyAck as screen-local state; must NOT rely solely on Upload re-mount to reset.
  Parallelization: Wave 3 | Owner: Kiral | Blocked by: 2 | Blocks: 13,15,16,17 | Parallel: 5,6,7,9,10
  References: spec §5.2; Metis M3 (lifecycle), A4 (safety ack persistence); Oracle-8 (reset on scan-initiation).
  Acceptance criteria (agent-executable): `npm test -- scanSession` PASS: setters mutate; reset clears photo/result/product AND safetyAckProductIds; ackSafety adds id once (idempotent).
  QA scenarios: happy — set/reset/ack assertions pass. failure — reset that leaves safetyAckProductIds populated, confirm FAIL, fix reset. Evidence `.omo/evidence/task-11-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(store): add scan-session store with lifecycle + safety-ack

- [ ] 12. Navigation shell — tab bar + scan stack + onboarding gate (typedRoutes)
  What to do / Must NOT do: Overwrite `app/_layout.tsx` (Stack + onboarding gate reading `wastex.onboarded`, with `.catch()` on the read → treat as not-onboarded, Metis A-onboarding). Create `app/(tabs)/_layout.tsx` (4 tabs, lucide icons), placeholder `app/(tabs)/{index,riwayat,impact,profil}.tsx`, `app/onboarding.tsx` (3 slides, skip, writes flag then replace to tabs). Register scan/product routes. Delete temp `app/index.tsx`. Rely on `typedRoutes` from T1.
  Parallelization: Wave 4 | Owner: Kiral | Blocked by: 1,8 | Blocks: 13,14,15,16 | Parallel: 9
  References: spec §5.1, §5.3; Metis M7 (typedRoutes), A-onboarding (read failure).
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `npm test -- onboarding` PASS — render `Onboarding`, assert slide 1 text renders, press "Lanjut" twice reaches "Mulai", press "Mulai" calls `AsyncStorage.setItem("wastex.onboarded","1")` (mocked) and `router.replace` to tabs; a second test where the gate's `getItem` mock rejects still routes to onboarding (no throw).
  QA scenarios: happy — onboarding render/press test passes (RNTL). failure — make gate treat rejected getItem as onboarded, confirm test FAILS, restore not-onboarded fallback. Evidence `.omo/evidence/task-12-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(nav): add tab shell, scan stack, onboarding gate with typedRoutes

- [ ] 13. Upload screen with camera/gallery + permission UX [Metis U3]
  What to do / Must NOT do: `app/scan/upload.tsx`: reset scan session on mount AND at setPhoto start (lifecycle T11); expo-image-picker camera & gallery (ensure the `expo-image-picker` config plugin is present in app config for the Android build — Oracle-10); on `!perm.granted` show `Alert.alert("Izin diperlukan", ...)` (no silent return, Metis U3); preview; "Analisis" sets photoUri + `router.push("/scan/hasil")`. Must NOT proceed without a photo.
  Parallelization: Wave 5 | Owner: Kiral | Blocked by: 10,11,12 | Blocks: 20 | Parallel: 14,16
  References: spec §5.2, §5.4; Metis U3 (permission UX), M3 (reset on scan-initiation).
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `npm test -- upload` PASS — mock expo-image-picker granted+asset → "Analisis" enabled and pressing it calls `setPhoto` + `router.push("/scan/hasil")`; mock permission denied → `Alert.alert` spy called with "Izin diperlukan" and no navigation; on mount `useScanSession.reset` is invoked (scan-initiation reset).
  QA scenarios: happy — granted-permission pick→Analisis→push test passes. failure — denied permission path silently returns (before fix), confirm Alert-spy test FAILS, add Alert. Evidence `.omo/evidence/task-13-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(scan): add upload screen with camera/gallery and permission UX

- [ ] 14. Beranda with recent-history shortcut [Metis S2]
  What to do / Must NOT do: Overwrite `app/(tabs)/index.tsx`: Header, big "Scan Sampah" button → `/scan/upload`, "Cara Pakai" card, AND a "Riwayat Terakhir" section reading last 3 from `impact.getHistory()` via useServiceCall, each tappable → `/product/${item.product.id}` (route with the PRODUCT id, NOT SavedProject.id — Oracle-4; guarded per T17). Empty history → hide the section entirely (no phantom card).
  Parallelization: Wave 5 | Owner: Falih | Blocked by: 7,12 | Blocks: 20 | Parallel: 13,15,16
  References: spec §5.1 ("shortcut riwayat terakhir"); Metis S2; Oracle-4 (product.id routing).
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `npm test -- beranda` PASS — with a seeded history item (mocked impact.getHistory), the recent section renders the product name and pressing it calls `router.push` with `/product/<product.id>` (asserts product id, not project id); with empty history the section is absent.
  QA scenarios: happy — seeded-history render + correct-id push test passes. failure — route with `item.id` (project id), confirm the id-assertion test FAILS, fix to `item.product.id`. Evidence `.omo/evidence/task-14-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(home): add Beranda with recent-history shortcut

- [ ] 15. Hasil screen — scan call, RiskBadge, 6-material manual correction
  What to do / Must NOT do: `app/scan/hasil.tsx` uses `scanner` + `useServiceCall`; shows LoadingSpinner while pending, ERROR state with retry on reject (Metis A1). Renders material card + RiskBadge + confidence. If `confidence<0.7` auto-show manual chooser; always offer "Bukan ini? Pilih manual". Manual chooser uses `MANUAL_MATERIALS`/`manualScanResult` from `@/services/scanner` (NEVER `@/mocks`, Metis C1). "Lihat Rekomendasi" → `/scan/rekomendasi`. Must NOT import `src/mocks`.
  Parallelization: Wave 5 | Owner: Kiral | Blocked by: 5,9,10,11,12 | Blocks: 20 | Parallel: 14
  References: spec §5.2, §6 (#3 manual correction); Metis C1, M1, A1.
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `grep -rL` check: `! grep -q "@/mocks" app/scan/hasil.tsx` (no mocks import); `npm test -- hasil` PASS — with scanner mocked to resolve a `kaca` result, RiskBadge shows "Berisiko" and confidence renders; with scanner mocked to confidence 0.55, the 6-item manual chooser auto-renders; with scanner mocked to reject, an error state with a retry control renders and pressing retry re-invokes scan.
  QA scenarios: happy — RNTL kaca-result + low-confidence-chooser tests pass. failure — force scanner reject with no error UI (before fix), confirm error-state test FAILS, add error+retry. Evidence `.omo/evidence/task-15-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(scan): add result screen with risk badge and manual correction

- [ ] 16. Rekomendasi screen
  What to do / Must NOT do: `app/scan/rekomendasi.tsx` uses `recommendation`+`useServiceCall`; LoadingSpinner/EmptyState/error+retry; FlatList of ProductCard; tap → `selectProduct` + `router.push("/product/[id]")`.
  Parallelization: Wave 5 | Owner: Falih | Blocked by: 6,9,10,11,12 | Blocks: 20 | Parallel: 13,14
  References: spec §5.2; Metis A1.
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `npm test -- rekomendasi` PASS — with recommendation mocked to resolve 3 items, 3 ProductCards render and tapping one calls `selectProduct` + `router.push("/product/<id>")`; with mock resolving [] the EmptyState renders; with mock rejecting, error+retry renders.
  QA scenarios: happy — 3-card render + tap-navigation test passes. failure — force reject with no error UI, confirm error-state test FAILS, add error+retry. Evidence `.omo/evidence/task-16-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(scan): add product recommendation screen

- [ ] 17. Product detail — 4 tabs + safety modal + save (session-guarded) [Metis M6, A3, A4]
  What to do / Must NOT do: `app/product/[id].tsx` loads tutorial/pricing/selling by id via useServiceCall (works even without session). Internal tabs: Tutorial (TutorialStepCard list + tools), Preview (before/after/mockup images), Harga (formatRupiah rows + range + notes), Jual (name/desc/captions/photoTips/packaging). SafetyModal auto-opens on Tutorial tab when risk is hati_hati/berisiko AND product id not in `safetyAckProductIds` (persisted, Metis A4); Kembali switches to Preview. "Simpan ke Riwayat & Catat Impact": if `result`/`selectedProduct` null (deep link/history reopen) DISABLE button with hint "Scan dulu untuk menyimpan" (Metis M6, A3); else save via impact, reset session, `router.replace("/(tabs)")`.
  Parallelization: Wave 6 | Owner: Kiral | Blocked by: 6,7,9,10,11 | Blocks: 20 | Parallel: 18,19
  References: spec §5.2, §6 (#2 safety); Metis M6, A3, A4.
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `npm test -- product` PASS — with a `berisiko` session result, mounting and viewing the Tutorial tab renders the SafetyModal once; after ackSafety, a remount does NOT re-open it (reads persisted `safetyAckProductIds`); switching to each of the 4 tabs renders its key content (a tutorial step, an image, a formatted Rupiah row, a caption); with `result`/`selectedProduct` null the Simpan control is disabled and shows the hint; with an active session, pressing Simpan calls `impact.saveProject` then `reset` then `router.replace`.
  QA scenarios: happy — safety-modal-once + 4-tab + guarded-save tests pass. failure — keep safetyAck in screen-local state so remount re-triggers, confirm the "not re-open" test FAILS, move ack to store. Evidence `.omo/evidence/task-17-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(product): add detail with 4 tabs, safety modal, guarded save

- [ ] 18. Riwayat + Impact screens (with simple chart, re-openable) [Metis S1, S3]
  What to do / Must NOT do: `src/store/useImpact.ts` `useImpactData()` (history+summary, refresh on focus via `useFocusEffect` from `expo-router`; if that import is unavailable in the installed SDK, fall back to `@react-navigation/native` — verify at build, Metis U2/Oracle). Overwrite `app/(tabs)/riwayat.tsx`: FlatList; each item tappable → `/product/${item.product.id}` (PRODUCT id, not project id — Oracle-4; guarded save per T17) + Hapus. Overwrite `app/(tabs)/impact.tsx`: 3 metric cards + a simple bar chart implemented as plain `<View>` bars (NO new dependency — resolves Momus-2) plotting the 3 summary totals (waste processed, products made, economic value) normalized to the max. Must NOT install a chart library.
  Parallelization: Wave 6 | Owner: Falih | Blocked by: 7,10 | Blocks: 20 | Parallel: 17,19
  References: spec §5.1 (grafik + reopen); Metis S1, S3, U2; Momus-2 (single chart choice); Oracle-4.
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `npm test -- impact-screens` PASS — with 2 seeded history items (mocked impact), Riwayat renders 2 rows and tapping one pushes `/product/<product.id>`; Hapus calls `impact.deleteProject`; Impact renders the 3 metric values AND 3 `<View>` bars (testID `impact-bar`), and with empty history renders EmptyState in Riwayat and zeroed metrics with no crash.
  QA scenarios: happy — seeded 2-item Riwayat + 3-bar Impact test passes. failure — empty-history path throws on chart (before guard), confirm empty test FAILS, guard the normalization divide-by-zero. Evidence `.omo/evidence/task-18-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(impact): add history and impact screens with simple View-bar chart

- [ ] 19. Profil screen + clear-data
  What to do / Must NOT do: Overwrite `app/(tabs)/profil.tsx`: mock user card, privacy note, "Hapus Semua Data" → Alert confirm → `impact.clearAll()`. `clearAll()` MUST remove only the `wastex.history.v1` key (via `AsyncStorage.removeItem`), NOT `AsyncStorage.clear()` — it must not wipe the `wastex.onboarded` flag and re-trigger onboarding (Oracle-7). Must NOT delete without confirm.
  Parallelization: Wave 6 | Owner: Falih | Blocked by: 7 | Blocks: 20 | Parallel: 17,18
  References: spec §5.1 (opsi hapus data), privacy §2; Oracle-7 (scoped clear).
  Acceptance criteria (agent-executable): `npx tsc --noEmit` clean; `npm test -- profil` PASS — pressing "Hapus Semua Data" and confirming the Alert calls `impact.clearAll`; a `LocalImpactService.clearAll` unit assertion confirms `wastex.onboarded` remains set after clear (only history removed); cancel path does not call clearAll.
  QA scenarios: happy — confirm-clear calls clearAll and onboarding flag survives (test passes). failure — implement clearAll as AsyncStorage.clear(), confirm the "onboarding flag survives" assertion FAILS, switch to removeItem. Evidence `.omo/evidence/task-19-wastex-mobile-mockfirst.txt`
  Commit: Y | feat(profile): add profile screen with scoped clear-data action

- [ ] 20. Hardening — arch-lint boundary, error/empty audit, integration tests, gates [Metis M5, A6]
  What to do / Must NOT do: Add ESLint `import/no-restricted-paths` (or `eslint-plugin-boundaries`) blocking `app/**`→`src/mocks/**`; add `npm run lint:arch` + a jest test that greps `app/` for `@/mocks` imports (Metis M5). Audit every screen for loading+empty+ERROR states. Add integration tests (Metis A6): registry returns Mock* when USE_MOCK true; `manualScanResult` per material; `useImpactData.refresh` populates. Run `npx expo lint`, `npm test`, `npx tsc --noEmit` all clean.
  Parallelization: Wave 7 | Owner: Falih | Blocked by: 13,14,15,16,17,18,19 | Blocks: 21 | Parallel: —
  References: Metis M5 (enforce boundary), A6 (integration tests), spec DoD §9.
  Acceptance criteria (agent-executable): `npm run lint:arch` exits 0; the mocks-import grep test PASSES (no violations); `npm test && npx tsc --noEmit && npx expo lint` all exit 0.
  QA scenarios: happy — all gates green. failure — add `import "@/mocks/materials"` to a screen, confirm lint:arch + test FAIL, remove it. Evidence `.omo/evidence/task-20-wastex-mobile-mockfirst.txt`
  Commit: Y | chore(quality): enforce import boundary, add integration tests, green gates

- [ ] 21. EAS preview APK + 10 screenshots mapped to Gambar 8–17 [Metis A5]
  What to do / Must NOT do: `eas.json` preview profile → Android `buildType: apk`, internal distribution. `eas build -p android --profile preview`. Install on device; walk full flow. Capture 10 screenshots and write `assets/screenshots/MAPPING.md` binding each to spec Tabel 16 / Gambar 8–17 (resolve the Before-After-vs-Mockup grouping per Metis A5; include Onboarding if it maps to a Gambar slot). Must NOT ship debug build to store.
  Parallelization: Wave 7 | Owner: Kiral (Vasco assists screenshots) | Blocked by: 20 | Blocks: — | Parallel: —
  References: spec §8 (Minggu 6), §9 (DoD); Metis A5 (screenshot mapping).
  Acceptance criteria (agent-executable): EAS returns a downloadable `.apk`; APK installs on Android and completes onboarding→scan→detail→save→Impact without crash; `assets/screenshots/` has 10 images + MAPPING.md.
  QA scenarios: happy — APK full-flow run, 10 screenshots captured. failure — if build fails, capture EAS error log to evidence and fix config. Evidence `.omo/evidence/task-21-wastex-mobile-mockfirst.txt`
  Commit: Y | chore(release): add EAS preview APK config and proposal screenshots

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
- One commit per todo (21 commits), Conventional Commits (`feat`/`chore`/`fix` + scope), as specified per-todo.
- Each feature developed on a branch, merged via pull request reviewed by ≥1 other member (spec DoD §9).
- Commit only after that todo's acceptance criteria pass (`tsc`/`test`/`lint` green as applicable).
- No commit mixes two todos; no commit lands red gates.

## Success criteria
1. All 21 todos complete; every acceptance-criteria command exits 0; evidence captured under `.omo/evidence/`.
2. Full flow works end-to-end on device with mocks: onboarding → Beranda → scan/upload → hasil (risk badge + 6-material manual correction) → rekomendasi → product detail (4 tabs + safety modal) → save → Riwayat/Impact update; Profil clear-data empties both.
3. History + Impact persist across restarts (AsyncStorage) and survive corrupt data (no crash).
4. Every service call has loading + empty + error(+retry) states; no screen hangs on a rejected promise.
5. `USE_MOCK` is the only mock↔real seam; no `app/**` file imports `src/mocks` (enforced by `npm run lint:arch` + test).
6. `npm test`, `npx tsc --noEmit`, `npx expo lint` all green.
7. EAS preview APK installs on Android and runs the full flow; 10 screenshots + `MAPPING.md` cover spec Gambar 8–17.
8. Final verification wave F1–F4 all APPROVE.
9. AI + backend remain absent (out of scope); the plan leaves a clean handoff (`USE_MOCK=false` + `Api*` implementations) for the next phase.
