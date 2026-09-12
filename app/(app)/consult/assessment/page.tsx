import { ConsultAssessmentIntro } from "@/features/consultations/ConsultAssessmentIntro";
import { getCurrentSession } from "@/lib/auth/session";
import { getActiveConsultAssessmentForUser } from "@/features/consultations/assessment/queries";
import { getConsultBookingPath, normalizeAssessmentDoctorId } from "@/features/consultations/assessment/routes";
import { redirect } from "next/navigation";

export default async function ConsultAssessmentPage({
  searchParams
}: {
  searchParams?: Promise<{
    retake?: string;
    doctorId?: string;
    consent?: string;
  }>;
}) {
  const params = await searchParams;
  const doctorId = normalizeAssessmentDoctorId(params?.doctorId);
  const session = await getCurrentSession();
  const activeAssessment = session ? await getActiveConsultAssessmentForUser(session.userId) : null;

  if (activeAssessment && params?.retake !== "1") {
    if (doctorId) {
      redirect(getConsultBookingPath(doctorId));
    }

    redirect("/consult");
  }

  return <ConsultAssessmentIntro doctorId={doctorId} consentRequired={params?.consent === "required"} />;
}
