import { expect, test } from "@playwright/test";

test("Admin consultation payment review stays usable at 390x844", async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.request.post("/api/auth/dev-session", {
    data: { role: "admin" }
  });
  expect(response.ok()).toBe(true);

  await page.goto("/admin/payments");

  await expect(page).toHaveURL(/\/admin\/payments$/);
  await expect(
    page.getByRole("heading", { name: "คิวตรวจสอบการชำระเงิน" })
  ).toBeVisible();
  await expect(
    page.getByText("Application error", { exact: false })
  ).toHaveCount(0);
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(viewport.clientWidth).toBe(390);
  expect(viewport.scrollWidth).toBeLessThanOrEqual(390);

  const evidenceInput = page.locator('input[name="supportingEvidence"]');
  if ((await evidenceInput.count()) > 0) {
    await expect(evidenceInput.first()).toBeVisible();
    await expect(page.locator('textarea[name="confirmationNote"]').first()).toBeVisible();
    await expect(page.locator('select[name="evidenceSource"]').first()).toBeVisible();
  }
});
