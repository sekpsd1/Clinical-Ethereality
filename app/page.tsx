import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveConsultAssessmentForUser } from "@/features/consultations/assessment/queries";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (session) {
    const activeAssessment = await getActiveConsultAssessmentForUser(session.userId);

    if (activeAssessment) {
      redirect("/consult");
    }
  }

  redirect("/consult/assessment");
}
