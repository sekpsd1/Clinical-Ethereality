import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("external Zoom entry uses one primary device-and-join action with a safe denied-permission fallback", async ({
  page
}) => {
  const consultationId = "consultation-uat";
  const ticket = `v1.00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: () => Promise.reject(new DOMException("denied", "NotAllowedError"))
      }
    });
  });
  await page.route("**/api/zoom/handoff/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({ ok: true, consultationId })
    });
  });

  await page.goto(
    `/zoom-sdk/index.html?consultation=${consultationId}#handoff=${ticket}`
  );

  const primary = page.getByRole("button", {
    name: "ตรวจอุปกรณ์และเข้าห้อง Zoom"
  });
  await expect(primary).toBeVisible();
  await expect(page.getByRole("button", { name: "ทดสอบกล้องและไมโครโฟน" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await primary.click();

  await expect(page.getByRole("status")).toContainText("อนุญาตกล้องและไมโครโฟน");
  await expect(
    page.getByRole("button", { name: "ลองตรวจและเข้าห้อง Zoom อีกครั้ง" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "ทดสอบกล้องและไมโครโฟน" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
