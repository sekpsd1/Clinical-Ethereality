import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Route } from "next";
import { normalizeLineAuthNextPath } from "@/lib/auth/line-oauth";
import { authReturnPathHeader } from "@/lib/auth/return-path";
import { getCurrentSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/permissions";
import type { Role } from "@/lib/permissions/roles";

function getLineLoginPath(nextPath: string): string {
  return `/auth/line?next=${encodeURIComponent(normalizeLineAuthNextPath(nextPath))}`;
}

async function getRouteSpecificLoginPath(fallbackPath: string): Promise<string> {
  const requestHeaders = await headers();
  const returnPath = requestHeaders.get(authReturnPathHeader) ?? fallbackPath;

  return getLineLoginPath(returnPath);
}

export async function requireRoleSession(allowedRoles: readonly Role[], fallbackPath = "/auth/role-home") {
  const session = await getCurrentSession();

  if (!session) {
    redirect((await getRouteSpecificLoginPath(fallbackPath)) as Route);
  }

  if (!hasRole(session, allowedRoles)) {
    redirect("/consult");
  }

  return session;
}

export async function requireAdminSession() {
  return requireRoleSession(["admin"], "/admin");
}

export async function requireDoctorSession() {
  return requireRoleSession(["doctor", "admin"], "/doctor/consultations");
}

export async function requirePharmacistSession() {
  return requireRoleSession(["pharmacist", "admin"], "/pharmacist/prescriptions");
}
