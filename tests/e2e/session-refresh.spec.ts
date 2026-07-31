import { expect, type BrowserContext, type Page, test } from "@playwright/test";

type DevRole = "customer" | "doctor" | "pharmacist" | "admin";

const accessCookieName = "ce_access_token";
const refreshCookieName = "ce_refresh_token";

async function signInWithPersistentRefresh(page: Page, role: DevRole) {
  const response = await page.request.post("/api/auth/dev-session", {
    data: {
      role,
      persistRefreshSession: true
    }
  });
  const body = (await response.json()) as {
    error?: string;
    session?: {
      sessionId?: string;
      userId?: string;
      role?: string;
    };
  };

  expect(response.ok(), body.error).toBe(true);
  expect(body.session?.role).toBe(role);
  expect(body.session?.sessionId).toBeTruthy();
  expect(body.session?.userId).not.toMatch(/^dev:/);
}

async function getAuthCookies(context: BrowserContext) {
  const cookies = await context.cookies();
  const access = cookies.find((cookie) => cookie.name === accessCookieName);
  const refresh = cookies.find((cookie) => cookie.name === refreshCookieName);

  expect(access).toBeDefined();
  expect(refresh).toBeDefined();

  return {
    access: access!,
    refresh: refresh!
  };
}

async function removeExpiredAccessCookie(context: BrowserContext) {
  await context.clearCookies({ name: accessCookieName });
  const cookies = await context.cookies();
  expect(cookies.some((cookie) => cookie.name === accessCookieName)).toBe(false);
  expect(cookies.some((cookie) => cookie.name === refreshCookieName)).toBe(true);
}

async function replaceRefreshCookie(context: BrowserContext, value: string) {
  const refresh = (await context.cookies()).find((cookie) => cookie.name === refreshCookieName);
  expect(refresh).toBeDefined();
  await context.addCookies([
    {
      name: refresh!.name,
      value,
      domain: refresh!.domain,
      path: refresh!.path,
      expires: refresh!.expires,
      httpOnly: refresh!.httpOnly,
      secure: refresh!.secure,
      sameSite: refresh!.sameSite
    }
  ]);
}

function exactUrl(path: string) {
  return (url: URL) => `${url.pathname}${url.search}` === path;
}

test.describe("transparent protected-route session refresh", () => {
  for (const scenario of [
    { role: "customer", path: "/profile/settings?section=account&from=refresh" },
    { role: "doctor", path: "/doctor/notifications?filter=unread&from=refresh" },
    { role: "pharmacist", path: "/pharmacist/prescriptions?status=pending&from=refresh" },
    { role: "admin", path: "/admin/payments?status=pending&from=refresh" }
  ] as const) {
    test(`refreshes an expired ${scenario.role} access cookie without showing LINE login`, async ({ page, context }) => {
      await signInWithPersistentRefresh(page, scenario.role);
      const before = await getAuthCookies(context);
      const authNavigations: string[] = [];
      const targetStatuses: number[] = [];

      page.on("request", (request) => {
        if (request.isNavigationRequest() && new URL(request.url()).pathname === "/auth/line") {
          authNavigations.push(request.url());
        }
      });
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (response.request().isNavigationRequest() && `${url.pathname}${url.search}` === scenario.path) {
          targetStatuses.push(response.status());
        }
      });

      await removeExpiredAccessCookie(context);
      await page.goto(scenario.path);

      await expect(page).toHaveURL(exactUrl(scenario.path));
      expect(authNavigations).toEqual([]);
      expect(targetStatuses).toContain(307);
      expect(targetStatuses.some((status) => status >= 200 && status < 300)).toBe(true);

      const after = await getAuthCookies(context);
      expect(after.access.value).not.toBe(before.access.value);
      expect(after.refresh.value).not.toBe(before.refresh.value);
    });
  }

  test("sends an invalid refresh token to LINE once with the complete return URL", async ({ page, context }) => {
    const path = "/doctor/notifications?filter=unread&tag=a&tag=b";
    await signInWithPersistentRefresh(page, "doctor");
    await removeExpiredAccessCookie(context);
    await replaceRefreshCookie(context, "invalid-refresh-token");

    const authNavigations: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest() && new URL(request.url()).pathname === "/auth/line") {
        authNavigations.push(request.url());
      }
    });

    await page.goto(path);

    await expect(page).toHaveURL((url) => url.pathname === "/auth/line" && url.searchParams.get("next") === path);
    expect(authNavigations).toHaveLength(1);
  });

  test("rejects replay of a refresh token that has already been rotated", async ({ page, context }) => {
    const firstPath = "/doctor/notifications?from=first-rotation";
    const replayPath = "/doctor/patients?from=replayed-refresh";
    await signInWithPersistentRefresh(page, "doctor");
    const original = await getAuthCookies(context);

    await removeExpiredAccessCookie(context);
    await page.goto(firstPath);
    await expect(page).toHaveURL(exactUrl(firstPath));

    await removeExpiredAccessCookie(context);
    await replaceRefreshCookie(context, original.refresh.value);
    await page.goto(replayPath);

    await expect(page).toHaveURL(
      (url) => url.pathname === "/auth/line" && url.searchParams.get("next") === replayPath
    );
  });

  test("keeps concurrent Doctor navigations out of LINE Login while one request rotates", async ({ page, context }) => {
    const notificationsPath = "/doctor/notifications?from=concurrent-a";
    const patientsPath = "/doctor/patients?from=concurrent-b";
    await signInWithPersistentRefresh(page, "doctor");
    const secondPage = await context.newPage();
    const authNavigations: string[] = [];

    for (const observedPage of [page, secondPage]) {
      observedPage.on("request", (request) => {
        if (request.isNavigationRequest() && new URL(request.url()).pathname === "/auth/line") {
          authNavigations.push(request.url());
        }
      });
    }

    await removeExpiredAccessCookie(context);
    await Promise.all([page.goto(notificationsPath), secondPage.goto(patientsPath)]);

    await expect(page).toHaveURL(exactUrl(notificationsPath));
    await expect(secondPage).toHaveURL(exactUrl(patientsPath));
    expect(authNavigations).toEqual([]);
  });

  for (const [role, path, home, finalPath] of [
    ["customer", "/admin/users", "/consult/assessment", "/consult"],
    ["doctor", "/pharmacist/prescriptions", "/doctor/consultations", "/doctor/consultations"],
    ["pharmacist", "/doctor/consultations", "/pharmacist/prescriptions", "/pharmacist/prescriptions"]
  ] as const) {
    test(`refreshes ${role} before redirecting a mismatched staff route to its role home`, async ({ page, context }) => {
      await signInWithPersistentRefresh(page, role);
      const authNavigations: string[] = [];
      const roleRedirects: string[] = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && new URL(request.url()).pathname === "/auth/line") {
          authNavigations.push(request.url());
        }
      });
      page.on("response", (response) => {
        const responseUrl = new URL(response.url());
        if (response.request().isNavigationRequest() && responseUrl.pathname === path && response.status() === 307) {
          const location = response.headers().location;
          if (location) {
            roleRedirects.push(new URL(location, responseUrl).pathname);
          }
        }
      });

      await removeExpiredAccessCookie(context);
      await page.goto(path);

      await expect(page).toHaveURL(exactUrl(finalPath));
      expect(roleRedirects).toContain(home);
      expect(authNavigations).toEqual([]);
      const refreshed = await getAuthCookies(context);
      expect(refreshed.access.value).toBeTruthy();
    });
  }

  test("does not loop after the rotated access cookie is accepted", async ({ page, context }) => {
    const path = "/admin?from=loop-check";
    await signInWithPersistentRefresh(page, "admin");
    const authNavigations: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest() && new URL(request.url()).pathname === "/auth/line") {
        authNavigations.push(request.url());
      }
    });

    await removeExpiredAccessCookie(context);
    await page.goto(path);
    await expect(page).toHaveURL(exactUrl(path));
    await page.reload();

    await expect(page).toHaveURL(exactUrl(path));
    expect(authNavigations).toEqual([]);
  });
});
