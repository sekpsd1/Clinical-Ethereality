import type { PublicSession } from "@/lib/auth/types";
import type { Role } from "@/lib/permissions/roles";

export const permissions = [
  "profile:read:self",
  "profile:update:self",
  "consultation:create:self",
  "consultation:read:self",
  "consultation:read:assigned",
  "consultation:update:assigned",
  "prescription:create:assigned",
  "prescription:read:self",
  "prescription:read:assigned",
  "prescription:verify",
  "order:create:self",
  "order:read:self",
  "order:fulfill",
  "payment:create:self",
  "payment:review",
  "community:create:self",
  "community:moderate",
  "admin:access"
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<Role, readonly Permission[]> = {
  customer: [
    "profile:read:self",
    "profile:update:self",
    "consultation:create:self",
    "consultation:read:self",
    "prescription:read:self",
    "order:create:self",
    "order:read:self",
    "payment:create:self",
    "community:create:self"
  ],
  doctor: [
    "profile:read:self",
    "profile:update:self",
    "consultation:read:assigned",
    "consultation:update:assigned",
    "prescription:create:assigned",
    "prescription:read:assigned"
  ],
  pharmacist: ["profile:read:self", "profile:update:self", "prescription:verify", "order:fulfill"],
  admin: permissions
};

export function hasRole(session: PublicSession | null, allowedRoles: readonly Role[]): boolean {
  return Boolean(session && allowedRoles.includes(session.role));
}

export function hasPermission(session: PublicSession | null, permission: Permission): boolean {
  return Boolean(session && rolePermissions[session.role].includes(permission));
}

export function assertRole(
  session: PublicSession | null,
  allowedRoles: readonly Role[]
): asserts session is PublicSession {
  if (!hasRole(session, allowedRoles)) {
    throw new Error("This role is not allowed to perform this action.");
  }
}

export function assertPermission(
  session: PublicSession | null,
  permission: Permission
): asserts session is PublicSession {
  if (!hasPermission(session, permission)) {
    throw new Error("This permission is required to perform this action.");
  }
}

export function canReadOwnRecord(session: PublicSession | null, ownerUserId: string): boolean {
  return Boolean(session && (session.role === "admin" || session.userId === ownerUserId));
}

export function canReadAssignedRecord(
  session: PublicSession | null,
  assignedUserId: string,
  allowedRoles: readonly Role[]
): boolean {
  return Boolean(
    session && (session.role === "admin" || (allowedRoles.includes(session.role) && session.userId === assignedUserId))
  );
}
