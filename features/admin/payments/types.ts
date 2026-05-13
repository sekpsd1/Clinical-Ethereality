import type { PaymentStatus } from "@prisma/client";

export type AdminPaymentQueueItem = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerLineId: string;
  amount: string;
  status: PaymentStatus;
  slipImageUrl: string | null;
  itemSummary: string;
  submittedAt: string;
  reviewedAt: string | null;
};

export type AdminPaymentsData = {
  payments: AdminPaymentQueueItem[];
  summary: {
    pendingReview: number;
    verified: number;
    rejected: number;
  };
  unavailable?: boolean;
};
