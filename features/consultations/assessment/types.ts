export type AssessmentSymptom = "rash_or_sore" | "itching_or_redness" | "urinary_symptoms" | "other";

export type AssessmentDuration = "less24h" | "1-3days" | "more3days";

export type AssessmentRecommendation = {
  topic: string;
  specialty: string;
  reason: string;
};

export type ActiveConsultAssessment = {
  id: string;
  symptom: AssessmentSymptom;
  symptomLabel: string;
  duration: AssessmentDuration;
  durationLabel: string;
  recommendationTopic: string;
  recommendationSpecialty: string;
  recommendationReason: string;
  completedAt: string;
  expiresAt: string;
};
