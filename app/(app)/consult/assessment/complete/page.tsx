import { ConsultAssessmentComplete } from "@/features/consultations/ConsultAssessmentComplete";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveConsultAssessmentForUser } from "@/features/consultations/assessment/queries";
import { normalizeAssessmentDoctorId } from "@/features/consultations/assessment/routes";

export default async function ConsultAssessmentCompletePage({
  searchParams
}: {
  searchParams?: Promise<{
    doctorId?: string;
  }>;
}) {
  const params = await searchParams;
  const doctorId = normalizeAssessmentDoctorId(params?.doctorId);
  const session = await getCurrentSession();
  const assessment = session ? await getActiveConsultAssessmentForUser(session.userId) : null;

  return <ConsultAssessmentComplete assessment={assessment} doctorId={doctorId} />;
}
