import type { Route } from "next";
import { redirect } from "next/navigation";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveConsultAssessmentForUser } from "@/features/consultations/assessment/queries";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session) {
    if (session.role !== "customer") {
      redirect(getRoleHomePath(session.role) as Route);
    }

    const activeAssessment = await getActiveConsultAssessmentForUser(session.userId);

    if (activeAssessment) {
      redirect("/consult");
    }
  }

  redirect("/consult/assessment");
}
