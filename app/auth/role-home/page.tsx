import type { Route } from "next";
import { redirect } from "next/navigation";
import { getRoleHomePath } from "@/features/auth/role-routing";
import {
  requiresDoctorInvitationStatus,
  pendingDoctorStatusPath
} from "@/features/staff-invite/pending-doctor";
import { getCurrentSession } from "@/lib/auth/session";

export default async function RoleHomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth/line?next=%2Fauth%2Frole-home");
  }

  if (session.role === "customer" && await requiresDoctorInvitationStatus(session.userId)) {
    redirect(pendingDoctorStatusPath);
  }

  redirect(getRoleHomePath(session.role) as Route);
}
