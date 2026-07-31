import type { Role } from "@/lib/permissions/roles";

const roleHomePaths: Record<Role, string> = {
  customer: "/consult/assessment",
  doctor: "/doctor/consultations",
  pharmacist: "/pharmacist/prescriptions",
  admin: "/admin"
};

const genericCustomerEntryPaths = new Set(["/", "/consult", "/consult/assessment"]);
const staffPathRoles: Array<{
  prefix: string;
  roles: readonly Role[];
}> = [
  {
    prefix: "/admin",
    roles: ["admin"]
  },
  {
    prefix: "/doctor",
    roles: ["doctor", "admin"]
  },
  {
    prefix: "/pharmacist",
    roles: ["pharmacist", "admin"]
  }
];

function pathStartsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isSafePostLoginPath(value: string | null | undefined): value is string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }

  const pathname = value.split(/[?#]/, 1)[0];
  return !pathStartsWith(pathname, "/auth/line") && !pathStartsWith(pathname, "/api/auth/line") && pathname !== "/api/auth/refresh";
}

export function getRoleHomePath(role: Role): string {
  return roleHomePaths[role];
}

export function normalizePostLoginPath(value: string | null | undefined): string {
  return isSafePostLoginPath(value) ? value : "/auth/role-home";
}

export function resolvePostLoginPath(role: Role, requestedPath: string): string {
  const safePath = normalizePostLoginPath(requestedPath);
  const pathname = safePath.split(/[?#]/, 1)[0];
  const staffBoundary = staffPathRoles.find((boundary) => pathStartsWith(pathname, boundary.prefix));

  if (
    safePath === "/auth/role-home" ||
    (role !== "customer" && genericCustomerEntryPaths.has(pathname)) ||
    (staffBoundary && !staffBoundary.roles.includes(role))
  ) {
    return getRoleHomePath(role);
  }

  return safePath;
}
