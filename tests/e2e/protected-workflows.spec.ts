import { expect, type Page, test } from "@playwright/test";

type DevRole = "customer" | "doctor" | "pharmacist" | "admin";

async function signInAs(page: Page, role: DevRole) {
  const response = await page.request.post("/api/auth/dev-session", {
    data: {
      role
    }
  });

  expect(response.ok()).toBe(true);
}

async function expectAuthRedirect(page: Page, nextPath: string) {
  await expect(page).toHaveURL((url) => {
    return url.pathname === "/auth/line" && url.searchParams.get("next") === nextPath;
  });
}

test.describe("protected workflow integration", () => {
  test("redirects unauthenticated customer workflow access to LINE auth with return path", async ({ page }) => {
    await page.goto("/store/orders");

    await expectAuthRedirect(page, "/store/orders");
  });

  test("redirects unauthenticated staff workflow access to LINE auth with return path", async ({ page }) => {
    await page.goto("/admin/payments?status=pending");

    await expectAuthRedirect(page, "/admin/payments?status=pending");
  });

  test("keeps customer sessions out of admin, doctor, and pharmacist workflows", async ({ page }) => {
    await signInAs(page, "customer");

    for (const path of ["/admin/users", "/doctor/consultations", "/pharmacist/prescriptions"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/consult$/);
    }
  });

  test("enforces separate doctor and pharmacist workflow boundaries", async ({ page }) => {
    await signInAs(page, "doctor");
    await page.goto("/pharmacist/prescriptions");
    await expect(page).toHaveURL(/\/consult$/);

    await signInAs(page, "pharmacist");
    await page.goto("/doctor/consultations");
    await expect(page).toHaveURL(/\/consult$/);
  });

  test("allows admins to support protected doctor and pharmacist workflows", async ({ page }) => {
    await signInAs(page, "admin");

    await page.goto("/doctor/consultations");
    await expect(page).toHaveURL(/\/doctor\/consultations$/);
    await expect(page.getByRole("link", { name: "Consults" })).toHaveAttribute("aria-current", "page");

    await page.goto("/pharmacist/prescriptions");
    await expect(page).toHaveURL(/\/pharmacist\/prescriptions$/);
    await expect(page.locator('nav a[href="/pharmacist/prescriptions"]')).toHaveAttribute("aria-current", "page");
  });

  test("requires authentication before sensitive payment slip verification", async ({ request }) => {
    const response = await request.post("/api/payments/verify-slip", {
      data: {
        paymentId: "payment-id",
        qrPayload: "sample-qr-payload"
      }
    });

    expect(response.status()).toBe(401);

    const body = (await response.json()) as {
      ok: boolean;
      error?: string;
    };

    expect(body).toEqual({
      ok: false,
      error: "Authentication is required."
    });
  });
});
