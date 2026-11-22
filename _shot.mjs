import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000/";
const out = process.argv[3] ?? "/tmp/shot.png";
const sel = process.argv[4];
const width = Number(process.argv[5] ?? 1440);
const height = Number(process.argv[6] ?? 900);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
if (sel) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await el.screenshot({ path: out });
} else {
  await page.screenshot({ path: out, fullPage: false });
}
await browser.close();
console.log("saved", out);
