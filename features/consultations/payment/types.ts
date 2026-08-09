import type { ConsultationStatus } from "@prisma/client";
import type { PromptPayInstruction } from "@/lib/payments/promptpay";

export type ConsultationPaymentStatus = "idle" | "rejected" | "provider_error" | "cooldown" | "invalid" | "expired" | "not_found";

export type ConsultationPaymentDetail = {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatarUrl: string;
  scheduledDate: string;
  scheduledTime: string;
  status: ConsultationStatus;
  statusLabel: string;
  feeAmount: number;
  feeLabel: string;
  appointmentHref: string;
  waitingRoomHref: string;
  privateSlipAttachmentId: string | null;
  promptPay: PromptPayInstruction;
  verificationRetryAfterSeconds: number;
};

export type ConsultationPaymentData = {
  consultation: ConsultationPaymentDetail | null;
  paymentStatus: ConsultationPaymentStatus;
  unavailable?: boolean;
};
