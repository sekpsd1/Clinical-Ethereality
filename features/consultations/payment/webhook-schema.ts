import { z } from "zod";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";

const webhookIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);

const webhookAmount = z
  .number()
  .finite()
  .positive()
  .max(99_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
    message: "Payment webhook amounts must use at most two decimal places."
  });

const webhookTransactionReference = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => {
    try {
      normalizePaymentTransactionReference(value);
      return true;
    } catch {
      return false;
    }
  }, "Payment webhook transaction reference is invalid.");

const webhookEventBase = {
  eventId: webhookIdentifier,
  paymentId: z.string().trim().min(1).max(191),
  provider: z.enum(["slipok", "easyslip"])
} as const;

const verifiedEventSchema = z
  .object({
    ...webhookEventBase,
    eventType: z.literal("consultation.payment.verified"),
    amount: webhookAmount,
    receiverVerified: z.literal(true),
    transactionReference: webhookTransactionReference
  })
  .strict();

const rejectedEventSchema = z
  .object({
    ...webhookEventBase,
    eventType: z.literal("consultation.payment.rejected"),
    amount: webhookAmount
  })
  .strict();

const providerErrorEventSchema = z
  .object({
    ...webhookEventBase,
    eventType: z.literal("consultation.payment.provider_error")
  })
  .strict();

export const consultationPaymentWebhookEventSchema = z.discriminatedUnion("eventType", [
  verifiedEventSchema,
  rejectedEventSchema,
  providerErrorEventSchema
]);

export type ConsultationPaymentWebhookEvent = z.infer<typeof consultationPaymentWebhookEventSchema>;
export type ActionableConsultationPaymentWebhookEvent = Exclude<
  ConsultationPaymentWebhookEvent,
  { eventType: "consultation.payment.provider_error" }
>;
