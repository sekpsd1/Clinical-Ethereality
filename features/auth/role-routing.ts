import type { Role } from "@/lib/permissions/roles";

const roleHomePaths: Record<Role, string> = {
  customer: "/consult/assessment",
  doctor: "/doctor/consultations",
  pharmacist: "/pharmacist/prescriptions",
  admin: "/admin"
};

const genericCustomerEntryPaths = new Set(["/", "/consult", "/consult/assessment"]);

export function getRoleHomePath(role: Role): string {
  return roleHomePaths[role];
}

export function normalizePostLoginPath(value: string | null | undefined): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/auth/role-home";
}

export function resolvePostLoginPath(role: Role, requestedPath: string): string {
  const safePath = normalizePostLoginPath(requestedPath);
  const pathname = safePath.split(/[?#]/, 1)[0];

  if (safePath === "/auth/role-home" || (role !== "customer" && genericCustomerEntryPaths.has(pathname))) {
    return getRoleHomePath(role);
  }

  return safePath;
}
