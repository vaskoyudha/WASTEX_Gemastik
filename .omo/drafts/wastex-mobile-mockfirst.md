---
slug: wastex-mobile-mockfirst
status: review-approved-complete
intent: clear
review_required: true
review_round_id: round-3
plan_path: .omo/plans/wastex-mobile-mockfirst.md
review_final:
  round: 3
  momus: APPROVE — recomputed all 21 matrix rows as exact inverse; rows 10/11→17 fixed; T1 in-body line fixed; no regressions.
  oracle: APPROVE — exact-inverse verified all 21 rows; all round-1/2 fixes intact; no new defects from round-3 edits.
  receipts: both lanes returned unconditional APPROVE against current plan bytes; no edits since → live-plan validation holds.
  history: round1 (both CHANGES_REQUESTED) → round2 (oracle APPROVE, momus CHANGES_REQUESTED) → round3 (both APPROVE).
review_round_2:
  momus: CHANGES_REQUESTED — matrix rows 10 & 11 omit their inverse edge to 17; T1 in-body Blocks line (2,3,4,8) contradicts matrix row 1 (2,3,8,10,12).
  oracle: APPROVE — all 4 round-1 blockers resolved; flagged only the T1 in-body stale line as a non-blocking nit.
  fixes_applied_round_3:
    - matrix row 10 Blocks → 13,15,16,17,18; row 11 Blocks → 13,15,16,17 (added missing inverse edge to 17)
    - T10 & T11 in-body Blocks lines updated to match
    - T1 in-body Blocks line corrected 2,3,4,8 → 2,3,8,10,12
    - re-verified all 21 rows are exact inverse of Blocked-by; no intra-wave block edges
  note: plan changed after Oracle's round-2 approval → both lanes re-run fresh in round-3 per lifecycle contract.
review_round_1:
  momus: CHANGES_REQUESTED — (1) T12-T19 manual acceptance; (2) T18 chart forks + uninstalled dep; (3) Blocks/Blocked-by incoherent.
  oracle: CHANGES_REQUESTED — (1) typedRoutes wrong file; (2) tailwindcss unpinned; (3) jest setup unlisted same-wave dep; (4) history reopen wrong id. +6 non-blocking.
  fixes_applied_round_2:
    - typedRoutes moved to app.json experiments + keep .expo/types in tsconfig include (Oracle-1)
    - tailwindcss pinned ^3.4.17 + acceptance check; do-not-install-v4 guard (Oracle-2)
    - jest.config + reanimated mock + broad transformIgnorePatterns moved into T1; T3 no longer creates it (Oracle-3)
    - history reopen routes with product.id in T14 + T18 (Oracle-4)
    - nativewind/babel in presets (Oracle-5); reanimated jest mock (Oracle-6); clearAll removeItem-only (Oracle-7); lifecycle reset on scan-initiation (Oracle-8); matrix T15/16 reconciled (Oracle-9); expo-image-picker plugin note (Oracle-10)
    - T12-T19 acceptance converted to agent-executable RNTL `npm test -- <screen>` commands (Momus-1)
    - T18 chart resolved to plain <View> bars plotting 3 totals, no new dep (Momus-2)
    - Blocks recomputed as exact inverse of Blocked-by across all 21 rows + matrix note (Momus-3)
review_required: false
pending-action: write .omo/plans/wastex-mobile-mockfirst.md
approach: Build the complete WASTEX mobile UI (13 screens) on Expo/React Native + TypeScript + NativeWind v4, with all AI behind a Service Layer + Mock Adapter (single USE_MOCK switch). History/Impact persist via AsyncStorage. TDD for pure logic; agent-executed QA per todo. AI + backend explicitly out of scope.
classification: Standard-to-Architecture (13 screens, 6 services, ~19 executable todos)
source_artifacts:
  - .omo/2026-02-18-wastex-mobile-phase-design.md (approved design spec)
  - .omo/plans/2026-02-18-wastex-mobile-implementation.md (prior writing-plans output, same subject)
---

# Draft: wastex-mobile-mockfirst

## Components (topology ledger)
<!-- id | outcome (one line) | status | evidence path -->
- C1 project-foundation | Expo+TS+NativeWind v4+Expo Router boots, green screen renders | active | spec §3.2, §3.3
- C2 service-contracts | `src/services/types.ts` frozen; 6 service interfaces defined | active | spec §4
- C3 mock-data-and-services | 6 mock services return contract types with simulated delay | active | spec §4.2–4.8
- C4 local-persistence | LocalImpactService (AsyncStorage) saves/reads history + impact | active | spec §4.7
- C5 design-system | base + feature components (Button…RiskBadge, SafetyModal) | active | spec §3.3
- C6 navigation-shell | Expo Router tab bar + scan stack + onboarding gate | active | spec §5.1, §5.3
- C7 scan-flow-screens | upload → hasil (badge+manual correction) → rekomendasi → detail (4 tabs) | active | spec §5.2
- C8 tabs-screens | Beranda, Riwayat, Impact, Profil (+ clear-data) | active | spec §5.1
- C9 release-assets | EAS preview APK + 10 proposal screenshots | active | spec §8 (Minggu 6), §9

## Open assumptions (announced defaults)
<!-- assumption | adopted default | rationale | reversible? -->
- Test framework | Jest + @testing-library/react-native via jest-expo | Expo-standard, matches prior plan | yes
- NativeWind major | v4 (preset in tailwind.config, withNativeWind metro, global.css) | verified current stable via Context7 docs | yes
- Placeholder images | remote https://placehold.co URLs | avoids local asset wiring in mock phase | yes
- Economic-value proxy in Impact | product.estimatedCost | mock stand-in; AI phase swaps to suggestedSellPrice | yes
- Slug | wastex-mobile-mockfirst | distinct from dated prior plan file; avoids collision | yes

## Findings (cited - path:lines)
- Greenfield: only `.docx` proposals + `.omo/` artifacts exist; no source code (dir listing /home/victus/Documents/gemastik).
- Approved spec fully specifies architecture, 6 service contracts, 13 screens, team split, 6-week timeline (.omo/2026-02-18-wastex-mobile-phase-design.md).
- Prior writing-plans output already decomposed the same subject into 19 TDD tasks (.omo/plans/2026-02-18-wastex-mobile-implementation.md) — reused as evidence, re-expressed under Prometheus template.
- NativeWind v4 Expo setup verified against Context7 `/nativewind/nativewind`: babel `jsxImportSource`, `withNativeWind(config,{input})` metro, `nativewind/preset` in tailwind, `nativewind-env.d.ts`.
- Write boundary: prometheus-md-only restricts Write/Edit to `.omo/*.md`; scaffold script writes via node:fs out-of-band. Actual project code created only at $start-work in a real repo dir.

## Decisions (with rationale)
- Reuse the approved design + prior task decomposition verbatim in substance; Prometheus plan re-expresses them with dependency matrix, parallel waves, and agent-executed QA per todo. Rationale: subject unchanged; user asked for the same plan under ulw-plan rules.
- Screens may import only from src/services|components|features|store|lib — never src/mocks. Manual-correction data exposed via `src/services/scanner` helpers. Rationale: keeps UI clean for AI swap (spec Global Constraints).
- Single USE_MOCK switch in registry is the only mock↔real seam. Rationale: zero screen edits at AI-integration time.

## Scope IN
- All 13 screens, 6 mock services + registry, AsyncStorage persistence, design system, navigation, onboarding, safety-first treatment, manual correction, EAS preview APK, 10 screenshots.

## Scope OUT (Must NOT have)
- Real Vision AI, LLM (DeepSeek-V3), image generation, Multimodal-RAG, Self-Expanding Skill Library, expert dashboard.
- Backend FastAPI, real auth, Supabase DB/Storage, Railway deploy.
- Favorites, social share, push notifications, complex gamification, multi-language, 👍/👎 feedback, "Jelajahi Ide" (explicitly deferred in spec §6).
- Any scope reduction of the 13 screens ("MVP subset") — full scope is the default.

## Open questions
(none — all design forks were resolved in the prior brainstorming session and recorded in the approved spec)

## Approval gate
status: plan-complete
approach: as recorded in front-matter `approach`.
plan_path: .omo/plans/wastex-mobile-mockfirst.md
metis: run — folded 5 P0 + 12 P1 + selected P2 findings into todos (M1 6-material manual list, M2/A1 useServiceCall error+retry, M3/A2 scan-session lifecycle, M4 corrupt-safe storage, M5 arch-lint boundary, M6/A3 session-guarded save, S1 impact chart, S2 recent-history shortcut, S3 re-openable history, U2 useFocusEffect import check, U3 permission UX, U4 offline images, A4 persisted safety-ack, A5 screenshot mapping, C1 manual data behind service, C3 economic-value note, M7 typedRoutes).
structural_self_check: pass — first heading is TL;DR; 21 impl rows `- [ ] N.` + F1–F4 all column-zero; in-body deps aligned to matrix.
review: not required (CLEAR, no modifier). Optional high-accuracy review offered to user.
next workflow action: await user's choice — start execution ($start-work) or run optional dual high-accuracy review.
