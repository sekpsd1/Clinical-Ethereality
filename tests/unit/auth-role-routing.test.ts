import { describe, expect, it } from "vitest";
import {
  getRoleHomePath,
  normalizePostLoginPath,
  resolvePostLoginPath
} from "@/features/auth/role-routing";

describe("role-aware authentication routing", () => {
  it.each([
    ["customer", "/consult/assessment"],
    ["doctor", "/doctor/consultations"],
    ["pharmacist", "/pharmacist/prescriptions"],
    ["admin", "/admin"]
  ] as const)("routes %s to its home screen", (role, expectedPath) => {
    expect(getRoleHomePath(role)).toBe(expectedPath);
  });

  it("routes staff away from the generic customer entry flow", () => {
    expect(resolvePostLoginPath("doctor", "/consult/assessment")).toBe("/doctor/consultations");
    expect(resolvePostLoginPath("pharmacist", "/consult")).toBe("/pharmacist/prescriptions");
    expect(resolvePostLoginPath("admin", "/")).toBe("/admin");
  });

  it("keeps explicit internal destinations", () => {
    expect(resolvePostLoginPath("doctor", "/doctor/patients?tab=history&from=login")).toBe(
      "/doctor/patients?tab=history&from=login"
    );
    expect(resolvePostLoginPath("customer", "/profile")).toBe("/profile");
  });

  it.each([
    ["customer", "/admin/users", "/consult/assessment"],
    ["doctor", "/pharmacist/prescriptions", "/doctor/consultations"],
    ["pharmacist", "/doctor/consultations", "/pharmacist/prescriptions"]
  ] as const)("keeps %s out of mismatched staff next routes", (role, requestedPath, expectedPath) => {
    expect(resolvePostLoginPath(role, requestedPath)).toBe(expectedPath);
  });

  it("allows Admin support access to every staff next route", () => {
    expect(resolvePostLoginPath("admin", "/admin/payments")).toBe("/admin/payments");
    expect(resolvePostLoginPath("admin", "/doctor/notifications")).toBe("/doctor/notifications");
    expect(resolvePostLoginPath("admin", "/pharmacist/prescriptions")).toBe("/pharmacist/prescriptions");
  });

  it("rejects external, protocol-relative, backslash, and auth-loop destinations", () => {
    expect(normalizePostLoginPath("https://example.com")).toBe("/auth/role-home");
    expect(normalizePostLoginPath("//example.com")).toBe("/auth/role-home");
    expect(normalizePostLoginPath("/\\example.com")).toBe("/auth/role-home");
    expect(normalizePostLoginPath("/auth/line?next=%2Fdoctor%2Fnotifications")).toBe("/auth/role-home");
    expect(normalizePostLoginPath("/api/auth/refresh")).toBe("/auth/role-home");
    expect(normalizePostLoginPath("/api/auth/line/login")).toBe("/auth/role-home");
  });
});
