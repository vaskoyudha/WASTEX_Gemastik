import { test, expect } from "@playwright/test";

// Requires: npm run web (Expo), backend on :8000, EXPO_PUBLIC_USE_MOCK=false,
// EXPO_PUBLIC_SUPABASE_URL/ANON_KEY pointing at the remote project. The test
// user e2e-frontend@wastex.test must exist (created via Supabase admin API).

const TEST_USER = { email: "e2e-frontend@wastex.test", password: "e2e-password-123" };

test("user creates a skill from scan", async ({ page }) => {
  // Login — proposals/verify/create require auth (get_current_user).
  await page.goto("http://localhost:8081/login");
  await page.getByPlaceholder("nama@example.com").fill(TEST_USER.email);
  await page.getByPlaceholder("••••••••").fill(TEST_USER.password);
  await page.getByText("Masuk", { exact: true }).last().click();
  await expect(page.getByText("Upload Foto")).toBeVisible({ timeout: 30_000 });

  // Home → upload screen.
  await page.getByText("Upload Foto").click();

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
