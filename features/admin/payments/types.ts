import type { PaymentStatus } from "@prisma/client";

export type AdminPaymentQueueItem = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerLineId: string;
  amount: string;
  status: PaymentStatus;
  methodLabel: string;
  slipImageUrl: string | null;
  qrPayloadStatus: string;
  providerLabel: string;
  reviewSourceLabel: string;
  resultLabel: string;
  evidenceSummary: string;
  transRef: string | null;
  verifiedAmount: string | null;
  receiverName: string | null;
  reviewedByName: string | null;
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
  unavailable?: boolean;
};
