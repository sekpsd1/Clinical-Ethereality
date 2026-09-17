import type { ConsultationStatus } from "@prisma/client";
import type { DoctorConsultationItem } from "@/features/doctor/consultations/types";

const ACTIVE_CONSULTATION_PRIORITY: Partial<Record<ConsultationStatus, number>> = {
  live: 0,
  scheduled: 1
};

export const doctorQueueStatuses = ["scheduled", "live", "completed"] as const;

export type DoctorQueueStatus = (typeof doctorQueueStatuses)[number];

export function isDoctorQueueStatus(status: ConsultationStatus): status is DoctorQueueStatus {
  return doctorQueueStatuses.some((queueStatus) => queueStatus === status);
}

export function filterDoctorConsultationsByQueueStatus(
  consultations: DoctorConsultationItem[],
  status: DoctorQueueStatus
): DoctorConsultationItem[] {
  return consultations.filter((consultation) => consultation.status === status);
}

export function getNonOperationalDoctorConsultationCount(
  consultations: DoctorConsultationItem[]
): number {
  return consultations.filter((consultation) => !isDoctorQueueStatus(consultation.status)).length;
}

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
