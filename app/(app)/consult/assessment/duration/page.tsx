import { ConsultAssessmentDuration } from "@/features/consultations/ConsultAssessmentDuration";
import { normalizeAssessmentDoctorId } from "@/features/consultations/assessment/routes";
import { isAssessmentSymptom } from "@/features/consultations/assessment/rules";

export default async function ConsultAssessmentDurationPage({
  searchParams
}: {
  searchParams?: Promise<{
    symptom?: string;
    doctorId?: string;
  }>;
}) {
  const params = await searchParams;
  const symptom = isAssessmentSymptom(params?.symptom) ? params.symptom : null;
  const doctorId = normalizeAssessmentDoctorId(params?.doctorId);

  return <ConsultAssessmentDuration selectedSymptom={symptom} doctorId={doctorId} />;
}
