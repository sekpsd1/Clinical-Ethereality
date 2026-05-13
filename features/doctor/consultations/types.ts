import type { ConsultationStatus, PrescriptionStatus } from "@prisma/client";

export type DoctorConsultationItem = {
  id: string;
  patientName: string;
  patientLineId: string;
  status: ConsultationStatus;
  scheduledAt: string | null;
  summary: string | null;
  prescriptionCount: number;
  latestPrescriptionId: string | null;
  latestPrescriptionStatus: PrescriptionStatus | null;
  latestPrescriptionNotes: string | null;
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
