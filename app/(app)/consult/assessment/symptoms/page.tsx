import { ConsultAssessmentSymptoms } from "@/features/consultations/ConsultAssessmentSymptoms";
import { isAssessmentSymptom } from "@/features/consultations/assessment/rules";

export default async function ConsultAssessmentSymptomsPage({
  searchParams
}: {
  searchParams?: Promise<{
    symptom?: string;
  }>;
}) {
  const params = await searchParams;
  const symptom = isAssessmentSymptom(params?.symptom) ? params.symptom : null;

  return <ConsultAssessmentSymptoms initialSelectedSymptom={symptom} />;
}
