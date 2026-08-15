import type { PaymentStatus } from "@prisma/client";
import type { ManualRefundReadiness } from "@/features/payments/refund-readiness";

export type AdminPaymentQueueItem = {
  id: string;
  orderId: string | null;
  consultationId: string | null;
  orderCode: string;
  paymentKindLabel: string;
  canManualReview: boolean;
  customerName: string;
  customerPhone: string | null;
  customerPhoneVerificationStatus: "verified" | "pending" | "not_provided";
  amount: string;
  refundAmountInput: string;
  status: PaymentStatus;
  methodLabel: string;
  providerLabel: string;
  reviewSourceLabel: string;
  resultLabel: string;
  receiverLabel: string;
  itemSummary: string;
  submittedAt: string;
  reviewedAt: string | null;
};

export type AdminPaymentsData = {
  payments: AdminPaymentQueueItem[];
  summary: {
    pendingSlip: number;
    pendingReview: number;
    verified: number;
    rejected: number;
  };
  refundReadiness: ManualRefundReadiness;
  unavailable?: boolean;
};
