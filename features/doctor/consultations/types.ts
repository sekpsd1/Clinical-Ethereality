import type {
  ConsultationPrescriptionOutcomeStatus,
  ConsultationStatus,
  PaymentStatus,
  PrescriptionStatus
} from "@prisma/client";
import type { PrescriptionMedicationItem } from "@/features/prescriptions/items";

export type DoctorPrescriptionProduct = {
  id: string;
  name: string;
  availableQuantity: number;
};

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
  paymentStatus: PaymentStatus | null;
  paymentEvidenceSummary: string | null;
  paymentReviewedAt: string | null;
  canOpenConsultRoom: boolean;
  consultRoomHref: string | null;
  scheduledAt: string | null;
  canStartConsultation: boolean;
  startAvailableAt: string | null;
  startAvailableInMs: number | null;
  durationLabel: string;
  summary: string | null;
  prescriptionOutcomeStatus: ConsultationPrescriptionOutcomeStatus;
  prescriptionOutcomeLabel: string;
  prescriptionOutcomeUpdatedAt: string | null;
  canUpdatePrescriptionOutcome: boolean;
  attendance: {
    label: string;
    description: string;
    tone: "neutral" | "success" | "warning";
    normalCompletionEligible: boolean;
    noShowCompletionEligible: boolean;
    noShowRemainingSeconds: number | null;
  };
  prescriptionCount: number;
  latestPrescriptionId: string | null;
  latestPrescriptionStatus: PrescriptionStatus | null;
  latestPrescriptionNotes: string | null;
  latestPrescriptionMedication: PrescriptionMedicationItem | null;
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
  prescriptionProducts: DoctorPrescriptionProduct[];
  summary: {
    scheduled: number;
    live: number;
    completed: number;
  };
  unavailable?: boolean;
  missingDoctorProfile?: boolean;
};
