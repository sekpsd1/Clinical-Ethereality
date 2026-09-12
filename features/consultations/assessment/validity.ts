import type { Prisma } from "@prisma/client";

export const CONSULT_ASSESSMENT_VALIDITY_MS = 24 * 60 * 60 * 1000;

export function getConsultAssessmentExpiresAt(completedAt: Date): Date {
  return new Date(completedAt.getTime() + CONSULT_ASSESSMENT_VALIDITY_MS);
}

export function getActiveConsultAssessmentWhere(
  userId: string,
  now = new Date()
): Prisma.ConsultAssessmentWhereInput {
  return {
    userId,
    completedAt: {
      gt: new Date(now.getTime() - CONSULT_ASSESSMENT_VALIDITY_MS)
    },
    expiresAt: {
      gt: now
    }
  };
}

export function isConsultAssessmentActive(
  assessment: { completedAt: Date; expiresAt: Date },
  now = new Date()
): boolean {
  return (
    assessment.completedAt.getTime() > now.getTime() - CONSULT_ASSESSMENT_VALIDITY_MS &&
    assessment.expiresAt.getTime() > now.getTime()
  );
}
