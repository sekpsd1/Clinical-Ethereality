import { z } from "zod";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";

export const reviewPaymentSchema = z
  .object({
    paymentId: z.string().min(1),
    status: z.enum(["verified", "rejected"]),
    transactionReference: z.string().max(255).optional()
  })
  .superRefine((data, context) => {
    if (data.status !== "verified") {
      return;
    }

    try {
      normalizePaymentTransactionReference(data.transactionReference ?? "");
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transactionReference"],
        message: "A valid bank transaction reference is required to verify a payment."
      });
    }
  })
  .transform((data) => ({
    ...data,
    transactionReference:
      data.status === "verified"
        ? normalizePaymentTransactionReference(data.transactionReference ?? "")
        : undefined
  }));

export const manualStoreRefundSchema = z.object({
  paymentId: z.string().min(1),
  refundAmount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/),
  refundReason: z.string().trim().min(3).max(1000),
  refundTransactionReference: z.string().trim().min(1).max(255),
  confirmedExternalTransfer: z.literal("true")
});
