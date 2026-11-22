import { chromium } from "playwright";

const results = [];
const browser = await chromium.launch();

async function check(name, cond, extra = "") {
  results.push(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

// ---- Desktop ----
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const art = page.locator("#bukti-kriptografis");
  await art.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  check("ledger frame present", (await art.locator('[aria-label="Pratinjau ledger verifikasi"]').count()) === 1);
  check("5 rows render", (await art.locator('button[aria-pressed]').count()) === 5);
  check("root block label", (await art.locator('text=Root block').count()) === 1);
  check("tail block label", (await art.locator('text=Tail block').count()) === 1);
  check("state chips", (await art.locator('text=Valid').count()) >= 1);

  const detailBefore = await art.locator("aside").innerText();

  // click row 2
  const rows = art.locator('button[aria-pressed]');
  await rows.nth(1).click();
  await page.waitForTimeout(300);
  const detailAfter = await art.locator("aside").innerText();
  check("click row changes detail", detailAfter !== detailBefore);

  const pressed = await art.locator('button[aria-pressed="true"]').count();
  check("exactly one pressed row", pressed === 1);

  // frame overflow check (scoped to article)
  const overflow = await art.evaluate((el) => {
    const frame = el.querySelector('[aria-label="Pratinjau ledger verifikasi"]');
    if (!frame) return { sw: 0, cw: 0 };
    return { sw: frame.scrollWidth, cw: frame.clientWidth };
  });
  check("no horizontal overflow @1440", overflow.sw <= overflow.cw, `scroll=${overflow.sw} client=${overflow.cw}`);

  check("no console errors @desktop", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

// ---- Mobile ----
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const art = page.locator("#bukti-kriptografis");
  await art.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  check("5 rows render @390", (await art.locator('button[aria-pressed]').count()) === 5);

  const overflow = await art.evaluate((el) => {
    const frame = el.querySelector('[aria-label="Pratinjau ledger verifikasi"]');
    if (!frame) return { sw: 0, cw: 0 };
    return { sw: frame.scrollWidth, cw: frame.clientWidth };
  });
  check("no horizontal overflow @390", overflow.sw <= overflow.cw, `scroll=${overflow.sw} client=${overflow.cw}`);

  // touch target height of a row (the button itself)
  const rowH = await art.locator('button[aria-pressed]').first().evaluate((el) => el.getBoundingClientRect().height);
  check("row touch height ≥44", rowH >= 44, `h=${rowH}`);

  check("no console errors @mobile", errors.length === 0, errors.slice(0, 3).join(" | "));
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
