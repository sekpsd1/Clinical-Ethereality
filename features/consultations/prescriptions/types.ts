import type { PrescriptionStatus } from "@prisma/client";

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
  productSummary: string;
  linkedOrderCode: string | null;
  nextStepTitle: string;
  nextStepBody: string;
  ctaLabel: string;
  ctaHref: string;
};

export type CustomerPrescriptionsData = {
  prescriptions: CustomerPrescriptionItem[];
  summary: {
    pending: number;
    verified: number;
    rejected: number;
  };
  unavailable?: boolean;
};
