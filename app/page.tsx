import type { Route } from "next";
import { redirect } from "next/navigation";
import { getRoleHomePath } from "@/features/auth/role-routing";
import {
  requiresDoctorInvitationStatus,
  pendingDoctorStatusPath
} from "@/features/staff-invite/pending-doctor";
import { getCurrentSession } from "@/lib/auth/session";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session?.role === "customer" && await requiresDoctorInvitationStatus(session.userId)) {
    redirect(pendingDoctorStatusPath);
  }

  if (session && session.role !== "customer") {
    redirect(getRoleHomePath(session.role) as Route);
  }

  redirect("/consult");
}
