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
    expect(resolvePostLoginPath("doctor", "/doctor/patients")).toBe("/doctor/patients");
    expect(resolvePostLoginPath("customer", "/profile")).toBe("/profile");
  });

  it("rejects external and protocol-relative destinations", () => {
    expect(normalizePostLoginPath("https://example.com")).toBe("/auth/role-home");
    expect(normalizePostLoginPath("//example.com")).toBe("/auth/role-home");
  });
});
