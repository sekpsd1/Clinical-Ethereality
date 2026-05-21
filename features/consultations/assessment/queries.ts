import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { ActiveConsultAssessment, AssessmentDuration, AssessmentSymptom } from "@/features/consultations/assessment/types";

function mapActiveAssessment(assessment: {
  id: string;
  symptom: string;
  symptomLabel: string;
  duration: string;
  durationLabel: string;
  recommendationTopic: string;
  recommendationSpecialty: string;
  recommendationReason: string;
  completedAt: Date;
  expiresAt: Date;
}): ActiveConsultAssessment {
  return {
    id: assessment.id,
    symptom: assessment.symptom as AssessmentSymptom,
    symptomLabel: assessment.symptomLabel,
    duration: assessment.duration as AssessmentDuration,
    durationLabel: assessment.durationLabel,
    recommendationTopic: assessment.recommendationTopic,
    recommendationSpecialty: assessment.recommendationSpecialty,
    recommendationReason: assessment.recommendationReason,
    completedAt: assessment.completedAt.toISOString(),
    expiresAt: assessment.expiresAt.toISOString()
  };
}

export async function getActiveConsultAssessmentForUser(userId: string): Promise<ActiveConsultAssessment | null> {
  noStore();

  if (userId.startsWith("dev:")) {
    return null;
  }

  try {
    const assessment = await prisma.consultAssessment.findFirst({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        completedAt: "desc"
      },
      select: {
        id: true,
        symptom: true,
        symptomLabel: true,
        duration: true,
        durationLabel: true,
        recommendationTopic: true,
        recommendationSpecialty: true,
        recommendationReason: true,
        completedAt: true,
        expiresAt: true
      }
    });

    return assessment ? mapActiveAssessment(assessment) : null;
  } catch {
    return null;
  }
}
