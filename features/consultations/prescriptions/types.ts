import type { ConsultationPrescriptionOutcomeStatus, PrescriptionStatus } from "@prisma/client";

export type CustomerPrescriptionItem = {
  id: string;
  status: PrescriptionStatus;
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning" | "danger";
  doctorName: string;
  pharmacistName: string | null;
  consultationDate: string;
  verifiedAt: string | null;
  notes: string;
  medicationSummary: string | null;
  productSummary: string;
  linkedOrderCode: string | null;
  nextStepTitle: string;
  nextStepBody: string;
  ctaLabel: string;
  ctaHref: string;
};

export type CustomerConsultationPrescriptionOutcomeItem = {
  consultationId: string;
  status: Exclude<ConsultationPrescriptionOutcomeStatus, "prescription_issued">;
  statusLabel: string;
  statusTone: "neutral" | "success";
  doctorName: string;
  consultationDate: string;
};

export type CustomerPrescriptionsData = {
  prescriptions: CustomerPrescriptionItem[];
  consultationOutcomes: CustomerConsultationPrescriptionOutcomeItem[];
  summary: {
    pending: number;
    verified: number;
    rejected: number;
  };
  unavailable?: boolean;
};
