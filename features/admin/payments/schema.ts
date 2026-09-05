import { z } from "zod";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";
import {
  consultationManualReviewReasonCodes,
  manualAppointmentRejectionReasonCodes
} from "@/features/consultations/payment/manual-review";

const bangkokLocalDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function isExactBangkokLocalDateTime(value: string): boolean {
  if (!bangkokLocalDateTimePattern.test(value)) return false;
  const date = new Date(`${value}:00+07:00`);
  if (Number.isNaN(date.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}` === value;
}

const bangkokLocalDateTimeSchema = z
  .string()
  .refine(isExactBangkokLocalDateTime)
  .transform((value) => new Date(`${value}:00+07:00`));

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

export const manualConsultationPaymentReviewSchema = z
  .object({
    paymentId: z.string().min(1),
    amount: z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/),
    transactionReference: z.string().trim().min(1).max(255),
    transferredAt: bangkokLocalDateTimeSchema,
    customerReportedAt: bangkokLocalDateTimeSchema,
    reasonCode: z.enum(consultationManualReviewReasonCodes),
    confirmedExternalBankCheck: z.literal("true")
  })
  .superRefine((data, context) => {
    try {
      normalizePaymentTransactionReference(data.transactionReference);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["transactionReference"],
        message: "A valid bank transaction reference is required."
      });
    }
  })
  .transform((data) => ({
    ...data,
    transactionReference: normalizePaymentTransactionReference(
      data.transactionReference
    )
  }));

export const manualAppointmentPaymentIntakeSchema = z.object({
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  availabilityId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  transferredAt: bangkokLocalDateTimeSchema,
  reasonCode: z.enum(consultationManualReviewReasonCodes),
  confirmedManualIntake: z.literal("true")
});

export const manualAppointmentPaymentDecisionSchema = z.union([
  z
    .object({
      paymentId: z.string().min(1),
      decision: z.literal("verified"),
      transactionReference: z.string().trim().min(1).max(255),
      confirmedExternalBankCheck: z.literal("true")
    })
    .superRefine((data, context) => {
      try {
        normalizePaymentTransactionReference(data.transactionReference);
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transactionReference"],
          message: "A valid bank transaction reference is required."
        });
      }
    })
    .transform((data) => ({
      ...data,
      transactionReference: normalizePaymentTransactionReference(
        data.transactionReference
      )
    })),
  z.object({
    paymentId: z.string().min(1),
    decision: z.literal("rejected"),
    rejectionReasonCode: z.enum(manualAppointmentRejectionReasonCodes),
    confirmedRejection: z.literal("true")
  })
]);
