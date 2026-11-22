import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);

// scroll through to trigger all scroll animations
for (let i = 0; i < 40; i++) {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(120);
}
await page.waitForTimeout(1200);

const sections = ["#bukti-kriptografis", "#review-verifikator", "#loker-pipeline", "#skill-gap"];
for (const s of sections) {
  const el = page.locator(s).first();
  try {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    await el.screenshot({ path: `/tmp/sec-${s.slice(1)}.png` });
    console.log("ok", s);
  } catch (e) {
    console.log("fail", s, e.message);
  }
}
await browser.close();
