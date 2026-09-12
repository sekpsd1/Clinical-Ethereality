import { ConsultAssessmentSymptoms } from "@/features/consultations/ConsultAssessmentSymptoms";
import { normalizeAssessmentDoctorId } from "@/features/consultations/assessment/routes";
import { isAssessmentSymptom } from "@/features/consultations/assessment/rules";

export default async function ConsultAssessmentSymptomsPage({
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

  return <ConsultAssessmentSymptoms initialSelectedSymptom={symptom} doctorId={doctorId} />;
}
