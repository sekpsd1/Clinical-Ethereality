import type { ConsultationStatus, PrescriptionStatus } from "@prisma/client";

export type DoctorPatientLogItem = {
  id: string;
  patientName: string;
  patientLineId: string;
  consultationCount: number;
  latestConsultationStatus: ConsultationStatus | null;
  latestConsultationAt: string | null;
  latestSummary: string | null;
  prescriptionCount: number;
  latestPrescriptionStatus: PrescriptionStatus | null;
};

export type DoctorPatientsData = {
  patients: DoctorPatientLogItem[];
  summary: {
    totalPatients: number;
    activeConsultations: number;
    prescriptions: number;
  };
  unavailable?: boolean;
  missingDoctorProfile?: boolean;
};
