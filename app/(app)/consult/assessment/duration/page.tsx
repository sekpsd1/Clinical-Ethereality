import { ConsultAssessmentDuration } from "@/features/consultations/ConsultAssessmentDuration";
import { isAssessmentSymptom } from "@/features/consultations/assessment/rules";

export default async function ConsultAssessmentDurationPage({
  searchParams
}: {
  searchParams?: Promise<{
    symptom?: string;
  }>;
}) {
  const params = await searchParams;
  const symptom = isAssessmentSymptom(params?.symptom) ? params.symptom : null;

  return <ConsultAssessmentDuration selectedSymptom={symptom} />;
}
