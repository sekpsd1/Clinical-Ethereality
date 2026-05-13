import type { PrescriptionStatus } from "@prisma/client";

export type PharmacistPrescriptionItem = {
  id: string;
  status: PrescriptionStatus;
  patientName: string;
  doctorName: string;
  consultationSummary: string | null;
  notes: string | null;
  productSummary: string;
  createdAt: string;
  verifiedAt: string | null;
};

export type PharmacistPrescriptionsData = {
  prescriptions: PharmacistPrescriptionItem[];
  summary: {
    pendingVerification: number;
    verified: number;
    rejected: number;
  };
  unavailable?: boolean;
};
