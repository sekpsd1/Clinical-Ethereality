import type { ConsultationStatus, PrescriptionStatus } from "@prisma/client";

export type DoctorConsultationItem = {
  id: string;
  patientName: string;
  patientLineId: string;
  status: ConsultationStatus;
  readinessLabel: string;
  readinessTitle: string;
  readinessDescription: string;
  readinessTone: "neutral" | "success" | "warning" | "danger";
  paymentStatusLabel: string;
  paymentStatusDescription: string;
  canOpenConsultRoom: boolean;
  consultRoomHref: string | null;
  scheduledAt: string | null;
  summary: string | null;
  prescriptionCount: number;
  latestPrescriptionId: string | null;
  latestPrescriptionStatus: PrescriptionStatus | null;
  latestPrescriptionNotes: string | null;
  latestChatMessage:
    | {
        body: string;
        senderName: string;
        createdAt: string;
      }
    | null;
  assessment:
    | {
        symptomLabel: string;
        durationLabel: string;
        recommendationTopic: string;
        recommendationSpecialty: string;
        recommendationReason: string;
        completedAt: string;
        expiresAt: string;
      }
    | null;
  createdAt: string;
};

export type DoctorConsultationsData = {
  consultations: DoctorConsultationItem[];
  summary: {
    scheduled: number;
    live: number;
    completed: number;
  };
  unavailable?: boolean;
  missingDoctorProfile?: boolean;
};
