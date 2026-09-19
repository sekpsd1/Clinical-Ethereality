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
  paymentStatusLabel: string;
  paymentStatusDescription: string;
  nextStepLabel: string;
  nextStepDescription: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  chatHistoryHref: string | null;
};

export type CustomerAppointmentData = {
  appointment: CustomerAppointmentDetail | null;
  unavailable?: boolean;
};
