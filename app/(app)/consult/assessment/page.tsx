import { ConsultAssessmentIntro } from "@/features/consultations/ConsultAssessmentIntro";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveConsultAssessmentForUser } from "@/features/consultations/assessment/queries";
import { redirect } from "next/navigation";

export default async function ConsultAssessmentPage({
  searchParams
}: {
  searchParams?: Promise<{
    retake?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getCurrentSession();
  const activeAssessment = session ? await getActiveConsultAssessmentForUser(session.userId) : null;

  if (activeAssessment && params?.retake !== "1") {
    redirect("/consult");
  }

  return <ConsultAssessmentIntro />;
}
