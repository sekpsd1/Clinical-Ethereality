import { expect, test, type Page } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const buildConsentPreview = require("../helpers/build-consent-preview.cjs");
let assets: { javascript: string; css: string };

test.beforeAll(async () => { assets = await buildConsentPreview(); });
test.beforeEach(async ({ page }) => {
  await page.route("http://consent-preview.test/**", (route) => route.fulfill({ contentType: "text/html", body: `<html lang="th"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${assets.css}</style></head><body><div id="root"></div></body></html>` }));
  await page.goto("http://consent-preview.test/");
  await page.addScriptTag({ content: assets.javascript });
});

const open = async (page: Page) => { await page.getByRole("button", { name: "อ่านความยินยอม", exact: true }).click(); await expect(page.getByRole("dialog")).toBeVisible(); };
const bottom = async (page: Page) => {
  const region = page.getByRole("region", { name: "เอกสารความยินยอม Telemedicine" });
  await region.focus();
  await region.press("Control+End");
  await expect(page.getByRole("button", { name: "ยินยอม", exact: true })).toBeEnabled();
};

test("bottom only enables explicit acceptance, with accessible focus and visible mobile actions", async ({ page }, info) => {
  const checkbox = page.getByRole("checkbox");
  const submit = page.getByRole("button", { name: "ยืนยันการจอง", exact: true });
  await expect(checkbox).not.toBeChecked(); await expect(submit).toBeDisabled();
  await open(page);
  const dialog = page.getByRole("dialog");
  const region = page.getByRole("region", { name: "เอกสารความยินยอม Telemedicine" });
  await expect(region).toBeFocused();
  await expect(page.getByRole("button", { name: "ยินยอม", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.screenshot({ path: info.outputPath("consent-before-scroll.png") });
  await bottom(page);
  await expect(checkbox).not.toBeChecked();
  const layout = await dialog.evaluate((el) => {
    const r = el.getBoundingClientRect(); const footer = el.querySelector("footer")!.getBoundingClientRect(); const region = el.querySelector('[role="region"]')!.getBoundingClientRect(); const header = el.querySelector("header")!.getBoundingClientRect();
    return { fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, actionsVisible: footer.bottom <= r.bottom && region.bottom <= footer.top, noOverflow: el.scrollWidth <= el.clientWidth, headerVisible: header.top >= r.top, dialogScroll: el.scrollTop, dialogHeight: el.clientHeight, innerHeight: el.firstElementChild!.getBoundingClientRect().height };
  });
  expect(layout).toMatchObject({ fits: true, actionsVisible: true, noOverflow: true, headerVisible: true, dialogScroll: 0 });
  await page.screenshot({ path: info.outputPath("consent-after-scroll.png") });
  await page.getByRole("button", { name: "ยินยอม", exact: true }).focus();
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await expect(page.getByRole("button", { name: "ปิดความยินยอม", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "ยินยอม", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "ยินยอม", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(checkbox).toBeChecked(); await expect(submit).toBeEnabled();
  await expect(page.getByRole("button", { name: "อ่านความยินยอม", exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  await checkbox.uncheck(); await expect(submit).toBeDisabled();
});

test("checkbox cannot bypass reading, closing and declining never accept, reopen starts at top", async ({ page }) => {
  const checkbox = page.getByRole("checkbox");
  await checkbox.click(); await expect(page.getByRole("dialog")).toBeVisible(); await expect(checkbox).not.toBeChecked();
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(checkbox).not.toBeChecked();
  await open(page); await bottom(page); await page.getByRole("button", { name: "ไม่ยินยอม", exact: true }).click(); await expect(checkbox).not.toBeChecked();
  await open(page); await expect(page.getByRole("button", { name: "ยินยอม", exact: true })).toBeDisabled();
  expect(await page.getByRole("region", { name: "เอกสารความยินยอม Telemedicine" }).evaluate(el => el.scrollTop)).toBe(0);
  await page.getByRole("button", { name: "ปิดความยินยอม", exact: true }).click(); await expect(checkbox).not.toBeChecked();
});

test("a new booking or doctor change clears acceptance and an accepted document can be reopened", async ({ page }) => {
  const accept = async () => { await open(page); await bottom(page); await page.getByRole("button", { name: "ยินยอม", exact: true }).click(); await expect(page.getByRole("checkbox")).toBeChecked(); };
  await accept(); await open(page); await expect(page.getByRole("checkbox")).not.toBeChecked(); await expect(page.getByRole("button", { name: "ยินยอม", exact: true })).toBeDisabled(); await page.keyboard.press("Escape");
  await accept(); await page.getByRole("button", { name: "เปลี่ยนแพทย์ทดสอบ" }).click(); await expect(page.getByRole("checkbox")).not.toBeChecked();
  await accept(); await page.getByRole("button", { name: "เริ่มการจองใหม่" }).click(); await expect(page.getByRole("checkbox")).not.toBeChecked(); await expect(page.getByRole("button", { name: "ยืนยันการจอง", exact: true })).toBeDisabled();
});

test("minor and unverified guards remain and rescheduling does not ask for new consent", async ({ page }) => {
  for (const query of ["minor", "unverified", "reschedule"]) {
    await page.goto(`http://consent-preview.test/?${query}`); await page.addScriptTag({ content: assets.javascript });
    await expect(page.getByRole("button", { name: "อ่านความยินยอม", exact: true })).toHaveCount(0);
    if (query === "minor") await expect(page.getByText(/ผู้มีอายุต่ำกว่า 18 ปีไม่สามารถให้ความยินยอมเองได้/)).toBeVisible();
    if (query === "unverified") await expect(page.getByRole("button", { name: "ยืนยันข้อมูลเพื่อจอง" })).toBeDisabled();
    if (query === "reschedule") await expect(page.getByRole("button", { name: "ยืนยันเวลาใหม่" })).toBeEnabled();
  }
});

test("a fully visible document has an explicit accept path without scrolling", async ({ page }) => {
  // Compact the actual document for this edge case only; still use the real dialog and its geometry.
  await page.addStyleTag({ content: '[role="region"] > div { font-size:1px!important;line-height:1px!important } [role="region"] * { margin:0!important;padding:0!important;font-size:1px!important;line-height:1px!important }' });
  await open(page); await expect(page.getByRole("button", { name: "ยินยอม", exact: true })).toBeEnabled(); await expect(page.getByRole("checkbox")).not.toBeChecked();
});
