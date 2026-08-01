import { expect, test, type Page } from "@playwright/test";

async function signInAsDoctor(page: Page) {
  const response = await page.request.post("/api/auth/dev-session", {
    data: { role: "doctor" }
  });

  expect(response.ok()).toBe(true);
}

test("Doctor queue shows the booked duration without mobile overflow", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  await signInAsDoctor(page);
  await page.goto("/doctor/consultations");

  await expect(page).toHaveURL(/\/doctor\/consultations$/);
  await expect(page.getByText("ระยะเวลานัด", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d+ นาที/, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(pageErrors).toEqual([]);
});
