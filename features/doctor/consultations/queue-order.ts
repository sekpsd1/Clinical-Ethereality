import type { ConsultationStatus } from "@prisma/client";

const ACTIVE_CONSULTATION_PRIORITY: Partial<Record<ConsultationStatus, number>> = {
  live: 0,
  scheduled: 1
};

export function prioritizeDoctorConsultations<
  T extends { status: ConsultationStatus }
>(consultations: T[]): T[] {
  return consultations
    .map((consultation, originalIndex) => ({ consultation, originalIndex }))
    .sort((left, right) => {
      const leftPriority = ACTIVE_CONSULTATION_PRIORITY[left.consultation.status] ?? 2;
      const rightPriority = ACTIVE_CONSULTATION_PRIORITY[right.consultation.status] ?? 2;

      return leftPriority - rightPriority || left.originalIndex - right.originalIndex;
    })
    .map(({ consultation }) => consultation);
}
