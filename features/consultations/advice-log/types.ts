export type AdviceLogMedication = {
  name: string;
  details: string;
  warning: string | null;
};

export type CustomerAdviceLog = {
  consultationId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatarUrl: string | null;
  appointmentLabel: string;
  summary: string | null;
  medications: AdviceLogMedication[];
  prescriptionHref: string | null;
  returnHref: string;
};

export type CustomerAdviceLogData = {
  advice: CustomerAdviceLog | null;
  unavailable?: boolean;
};
