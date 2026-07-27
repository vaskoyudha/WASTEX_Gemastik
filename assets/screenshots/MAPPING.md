# Screenshot Mapping — WASTEX Proposal (Gambar 8–17)

## Instructions
1. Build APK: `npx eas-cli build -p android --profile preview` (requires Node >=20)
2. Install APK on Android device
3. Walk the full flow: Onboarding → Beranda → Upload → Hasil → Rekomendasi → Product Detail → Save → Riwayat → Impact → Profil
4. Capture screenshots below and save as `gambar-<N>.png` in this directory

| # | Gambar | Screen | Description |
|---|--------|--------|-------------|
| 1 | Gambar 8 | Onboarding | Slide 1 of onboarding (or slide with "Mulai" button) |
| 2 | Gambar 9 | Beranda | Home screen with hero, stats, and recent history |
| 3 | Gambar 10 | Upload | Upload screen with image picker preview + "Analisis" button |
| 4 | Gambar 11 | Hasil | Scan result with risk badge + manual correction (low confidence) |
| 5 | Gambar 12 | Rekomendasi | Product recommendation list with ProductCards |
| 6 | Gambar 13 | Product Detail — Tutorial | Tutorial tab with step cards + safety modal overlay |
| 7 | Gambar 14 | Product Detail — Preview | Before/after + mockup images tab |
| 8 | Gambar 15 | Product Detail — Harga | Pricing estimate with formatRupiah rows |
| 9 | Gambar 16 | Riwayat | History list with saved projects |
| 10 | Gambar 17 | Impact | Impact summary with 3 metric cards + bar chart |

## Notes
- Ensure all mocks resolve (USE_MOCK=true) during capture
- Use a material with `berisiko` risk level (e.g., kaca) to show safety modal
- Gallery/camera permission will be requested — grant it
- Screenshots should be 1080×2400 or native device resolution
