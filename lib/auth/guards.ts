import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { hasRole } from "@/lib/permissions";
import type { Role } from "@/lib/permissions/roles";

export async function requireRoleSession(allowedRoles: readonly Role[]) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/line?next=/admin");
  }

  if (!hasRole(session, allowedRoles)) {
    redirect("/consult");
  }

  return session;
}

export async function requireAdminSession() {
  return requireRoleSession(["admin"]);
}
