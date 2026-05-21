import { ConsultAssessmentComplete } from "@/features/consultations/ConsultAssessmentComplete";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveConsultAssessmentForUser } from "@/features/consultations/assessment/queries";

export default async function ConsultAssessmentCompletePage() {
  const session = await getCurrentSession();
  const assessment = session ? await getActiveConsultAssessmentForUser(session.userId) : null;

  return <ConsultAssessmentComplete assessment={assessment} />;
}
