import type { ConsultationStatus } from "@prisma/client";

export type CustomerAppointmentDetail = {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatarUrl: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledIso: string | null;
  status: ConsultationStatus;
  statusLabel: string;
  statusTone: "neutral" | "success" | "warning" | "danger";
  feeLabel: string;
  nextStepLabel: string;
  nextStepDescription: string;
  ctaLabel: string;
  ctaHref: string;
};

export type CustomerAppointmentData = {
  appointment: CustomerAppointmentDetail | null;
  unavailable?: boolean;
};
