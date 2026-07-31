import { afterEach, describe, expect, it } from "vitest";
import { getPublicAppOrigin, normalizeLineAuthNextPath } from "@/lib/auth/line-oauth";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("LINE OAuth URL helpers", () => {
  it("accepts only local absolute next paths", () => {
    expect(normalizeLineAuthNextPath("/admin/payments?status=pending&from=line")).toBe(
      "/admin/payments?status=pending&from=line"
    );
    expect(normalizeLineAuthNextPath("//attacker.example")).toBe("/auth/role-home");
    expect(normalizeLineAuthNextPath("/\\attacker.example")).toBe("/auth/role-home");
    expect(normalizeLineAuthNextPath("https://attacker.example")).toBe("/auth/role-home");
    expect(normalizeLineAuthNextPath("/auth/line?next=%2Fadmin")).toBe("/auth/role-home");
    expect(normalizeLineAuthNextPath("/api/auth/refresh")).toBe("/auth/role-home");
    expect(normalizeLineAuthNextPath("/api/auth/line/login")).toBe("/auth/role-home");
  });

  it("uses the configured public origin behind a reverse proxy", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.bccgroup-thailand.com/admin";

    expect(getPublicAppOrigin("http://0.0.0.0:3000")).toBe("https://app.bccgroup-thailand.com");
  });

  it("falls back when the configured URL is invalid", () => {
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";

    expect(getPublicAppOrigin("http://localhost:3001")).toBe("http://localhost:3001");
  });
});
