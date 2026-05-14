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

async function expectNoAppError(page: Page) {
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Unhandled Runtime Error", { exact: false })).toHaveCount(0);
}

async function expectCustomerFooter(page: Page, activeLabel?: "Consult" | "Store" | "Community" | "Profile") {
  const footerLabels = ["Consult", "Store", "Community", "Profile"] as const;
  const footer = page.getByRole("navigation", {
    name: "Primary"
  });

  await expect(footer).toBeVisible();

  for (const label of footerLabels) {
    await expect(footer.getByRole("link", { exact: true, name: label })).toBeVisible();
  }

  if (activeLabel) {
    await expect(footer.getByRole("link", { exact: true, name: activeLabel })).toHaveAttribute("aria-current", "page");
  } else {
    await expect(footer.locator('[aria-current="page"]')).toHaveCount(0);
  }
}

test.describe("customer mobile smoke", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, "customer");
  });

  const customerRoutes: Array<{
    path: string;
    activeLabel?: "Consult" | "Store" | "Community" | "Profile";
  }> = [
    { path: "/consult", activeLabel: "Consult" },
    { path: "/consult/payment", activeLabel: "Consult" },
    { path: "/consult/waiting-room", activeLabel: "Consult" },
    { path: "/consult/advice-log", activeLabel: "Consult" },
    { path: "/consult/prescriptions", activeLabel: "Consult" },
    { path: "/store", activeLabel: "Store" },
    { path: "/store/paracetamol-500mg", activeLabel: "Store" },
    { path: "/store/cart", activeLabel: "Store" },
    { path: "/store/checkout", activeLabel: "Store" },
    { path: "/store/orders", activeLabel: "Store" },
    { path: "/community", activeLabel: "Community" },
    { path: "/community/vitamin-c-tips", activeLabel: "Community" },
    { path: "/community/create", activeLabel: "Community" },
    { path: "/community/search", activeLabel: "Community" },
    { path: "/notifications" },
    { path: "/profile", activeLabel: "Profile" },
    { path: "/profile/settings", activeLabel: "Profile" },
    { path: "/profile/rewards", activeLabel: "Profile" }
  ];

  for (const route of customerRoutes) {
    test(`${route.path} loads with the shared mobile shell`, async ({ page }) => {
      await page.goto(route.path);

      await expectNoAppError(page);
      await expectCustomerFooter(page, route.activeLabel);
    });
  }

  test("/consult/live hides the customer footer during video consultation", async ({ page }) => {
    await page.goto("/consult/live");

    await expectNoAppError(page);
    await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
    await expect(page.getByText("Dr. Aris Thorne")).toBeVisible();
  });
});

test.describe("role route smoke", () => {
  test("admin dashboard is reachable with an admin dev session", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin");

    await expectNoAppError(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('nav a[href="/admin/users"]')).toBeVisible();
    await expect(page.locator('nav a[href="/admin/payments"]')).toBeVisible();
    await expect(page.locator('nav a[href="/admin/compliance"]')).toBeVisible();
  });

  test("admin user page exposes staff invitation links", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/users");

    await expectNoAppError(page);
    await expect(page.locator('a[href="/staff-invite/doctor"]')).toBeVisible();
    await expect(page.locator('a[href="/staff-invite/pharmacist"]')).toBeVisible();
    await expect(page.locator('a[href="/staff-invite/admin"]')).toBeVisible();
  });

  test("staff invite request page is reachable with a customer dev session", async ({ page }) => {
    await signInAs(page, "customer");
    await page.goto("/staff-invite/doctor");

    await expectNoAppError(page);
    await expect(page.getByRole("heading", { name: "ขอสิทธิ์แพทย์" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ส่งคำขอให้แอดมินตรวจ" })).toBeVisible();
  });

  test("admin compliance readiness is reachable with an admin dev session", async ({ page }) => {
    await signInAs(page, "admin");
    await page.goto("/admin/compliance");

    await expectNoAppError(page);
    await expect(page).toHaveURL(/\/admin\/compliance$/);
    await expect(page.getByRole("heading", { name: "ตรวจความพร้อมด้าน Compliance" })).toBeVisible();
    await expect(page.locator('nav a[href="/admin/compliance"]')).toHaveAttribute("aria-current", "page");
  });

  test("doctor queue is reachable with a doctor dev session", async ({ page }) => {
    await signInAs(page, "doctor");
    await page.goto("/doctor/consultations");

    await expectNoAppError(page);
    await expect(page).toHaveURL(/\/doctor\/consultations$/);
    await expect(page.getByRole("link", { name: "Consults" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Patients" })).toBeVisible();
  });

  test("pharmacist prescription queue is reachable with a pharmacist dev session", async ({ page }) => {
    await signInAs(page, "pharmacist");
    await page.goto("/pharmacist/prescriptions");

    await expectNoAppError(page);
    await expect(page).toHaveURL(/\/pharmacist\/prescriptions$/);
    await expect(page.locator('nav a[href="/pharmacist/prescriptions"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator('nav a[href="/pharmacist/orders"]')).toBeVisible();
  });
});
