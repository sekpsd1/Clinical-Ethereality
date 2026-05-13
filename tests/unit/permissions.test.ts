import { describe, expect, it } from "vitest";
import type { PublicSession } from "@/lib/auth/types";
import {
  assertPermission,
  assertRole,
  canReadAssignedRecord,
  canReadOwnRecord,
  hasPermission,
  hasRole,
  isRole,
  permissions,
  rolePermissions,
  type Permission,
  type Role
} from "@/lib/permissions";

function session(role: Role, userId = `${role}-user`): PublicSession {
  return {
    userId,
    lineUserId: `${role}-line-user`,
    role,
    displayName: `Local ${role}`,
    expiresAt: new Date("2030-01-01T00:00:00.000Z").toISOString()
  };
}

describe("roles", () => {
  it("recognizes only supported application roles", () => {
    expect(isRole("customer")).toBe(true);
    expect(isRole("doctor")).toBe(true);
    expect(isRole("pharmacist")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("guest")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});

describe("role permissions", () => {
  it("keeps admin access equivalent to every declared permission", () => {
    expect(rolePermissions.admin).toEqual(permissions);
  });

  it.each([
    ["customer", "order:create:self"],
    ["customer", "payment:create:self"],
    ["customer", "community:create:self"],
    ["doctor", "consultation:read:assigned"],
    ["doctor", "prescription:create:assigned"],
    ["pharmacist", "prescription:verify"],
    ["pharmacist", "order:fulfill"],
    ["admin", "admin:access"],
    ["admin", "payment:review"]
  ] satisfies Array<[Role, Permission]>)("allows %s to use %s", (role, permission) => {
    expect(hasPermission(session(role), permission)).toBe(true);
  });

  it.each([
    ["customer", "payment:review"],
    ["customer", "prescription:verify"],
    ["doctor", "order:fulfill"],
    ["doctor", "admin:access"],
    ["pharmacist", "consultation:update:assigned"],
    ["pharmacist", "community:moderate"]
  ] satisfies Array<[Role, Permission]>)("denies %s from using %s", (role, permission) => {
    expect(hasPermission(session(role), permission)).toBe(false);
  });

  it("denies permissions when no session exists", () => {
    expect(hasPermission(null, "profile:read:self")).toBe(false);
  });
});

describe("role checks", () => {
  it("allows sessions with one of the requested roles", () => {
    expect(hasRole(session("doctor"), ["doctor", "admin"])).toBe(true);
    expect(hasRole(session("admin"), ["doctor", "admin"])).toBe(true);
  });

  it("denies missing or disallowed roles", () => {
    expect(hasRole(session("customer"), ["doctor", "admin"])).toBe(false);
    expect(hasRole(null, ["customer"])).toBe(false);
  });

  it("throws when asserting a disallowed role", () => {
    expect(() => assertRole(session("customer"), ["admin"])).toThrow("This role is not allowed");
  });

  it("throws when asserting a missing permission", () => {
    expect(() => assertPermission(session("doctor"), "payment:review")).toThrow("This permission is required");
  });

  it("does not throw for allowed role and permission assertions", () => {
    expect(() => assertRole(session("admin"), ["admin"])).not.toThrow();
    expect(() => assertPermission(session("admin"), "payment:review")).not.toThrow();
  });
});

describe("record ownership helpers", () => {
  it("allows users and admins to read their own records", () => {
    expect(canReadOwnRecord(session("customer", "customer-1"), "customer-1")).toBe(true);
    expect(canReadOwnRecord(session("admin", "admin-1"), "customer-1")).toBe(true);
  });

  it("denies unrelated users from reading owned records", () => {
    expect(canReadOwnRecord(session("customer", "customer-1"), "customer-2")).toBe(false);
    expect(canReadOwnRecord(null, "customer-1")).toBe(false);
  });

  it("allows assigned staff and admins to read assigned records", () => {
    expect(canReadAssignedRecord(session("doctor", "doctor-1"), "doctor-1", ["doctor"])).toBe(true);
    expect(canReadAssignedRecord(session("pharmacist", "pharmacist-1"), "pharmacist-1", ["pharmacist"])).toBe(true);
    expect(canReadAssignedRecord(session("admin", "admin-1"), "doctor-1", ["doctor"])).toBe(true);
  });

  it("denies unassigned or wrong-role staff from reading assigned records", () => {
    expect(canReadAssignedRecord(session("doctor", "doctor-1"), "doctor-2", ["doctor"])).toBe(false);
    expect(canReadAssignedRecord(session("customer", "customer-1"), "customer-1", ["doctor"])).toBe(false);
    expect(canReadAssignedRecord(null, "doctor-1", ["doctor"])).toBe(false);
  });
});
