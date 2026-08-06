import { test, expect } from "@playwright/test";

// Requires: npm run web (Expo), backend on :8000, EXPO_PUBLIC_USE_MOCK=false.
test("user creates a skill from scan", async ({ page }) => {
  await page.goto("http://localhost:8081");
  // Scan flow: upload.tsx uses expo-image-picker, which on web only creates its
  // hidden <input type="file"> when the picker is opened — hook the file chooser
  // event from "Pilih dari Galeri" and feed the fixture through it.
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText("Pilih dari Galeri").click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("e2e/fixtures/sample.jpg");
  // Analyze the photo (LLM scan — allow generous time).
  await page.getByText("Analisis Sampah Sekarang").click();
  await expect(page.getByText("Buat Skill Baru dari Material Ini")).toBeVisible({
    timeout: 60_000,
  });
  await page.getByText("Buat Skill Baru dari Material Ini").click();
  await expect(page.getByText("Buat Skill Baru")).toBeVisible();
  // Pick the first proposal card — its difficulty badge ("pemula"/"menengah"/
  // "mahir") is stable text on every proposal card.
  await page.getByText(/pemula|menengah|mahir/).first().click();
  // Edit → verify → submit: the submit button ("Kirim Skill untuk Verifikasi")
  // lives in the verify modal and is only enabled after the AI layak verdict.
  await page.getByText("Verifikasi dengan AI").click();
  await expect(page.getByText("Skill layak dikirim")).toBeVisible();
  await page.getByText("Kirim Skill untuk Verifikasi").click();
  await expect(page.getByText(/menunggu|pending/i).first()).toBeVisible();
});
