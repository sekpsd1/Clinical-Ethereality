import type { ConsultationStatus, PrescriptionStatus } from "@prisma/client";

export type DoctorAssessmentAnswer = {
  key: string;
  label: string;
  value: string;
};

export type DoctorPatientConsultationDetail = {
  id: string;
  status: ConsultationStatus;
  statusLabel: string;
  scheduledAt: string | null;
  createdAt: string;
  summary: string | null;
  assessment:
    | {
        id: string;
        symptomLabel: string;
        durationLabel: string;
        recommendationTopic: string;
        recommendationSpecialty: string;
        recommendationReason: string;
        completedAt: string;
        answers: DoctorAssessmentAnswer[];
      }
    | null;
  prescriptions: Array<{
    id: string;
    status: PrescriptionStatus;
    notes: string | null;
    medicationSummary: string | null;
    createdAt: string;
  }>;
  recentMessages: Array<{
    id: string;
    senderName: string;
    body: string;
    createdAt: string;
  }>;
};

export type DoctorPatientDetailData = {
  patient:
    | {
        id: string;
        name: string;
        reference: string;
        consultations: DoctorPatientConsultationDetail[];
      }
    | null;
  unavailable?: boolean;
  missingDoctorProfile?: boolean;
};
