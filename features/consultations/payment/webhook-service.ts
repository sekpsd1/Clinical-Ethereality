import { Prisma, type ConsultationStatus, type PaymentStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";
import {
  applyConsultationPaymentVerification,
  type ConsultationPaymentSnapshot
} from "@/features/consultations/payment/service";
import type { ActionableConsultationPaymentWebhookEvent } from "@/features/consultations/payment/webhook-schema";
import {
  mergePaymentVerificationPayload,
  PaymentVerificationConflictError
} from "@/features/payments/service";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";

type WebhookOutcome = "verified" | "rejected" | "provider_error";

type StoredWebhookEvent = {
  eventId: string;
  outcome: WebhookOutcome;
  provider: "slipok" | "easyslip";
  classification: string | null;
  failureCode: string | null;
  retryAfterSeconds: number | null;
};

export type ConsultationPaymentWebhookPersistenceResult = "processed" | "replayed";

export class ConsultationPaymentWebhookNotActionableError extends Error {
  constructor() {
    super("The webhook event does not map to an actionable consultation payment.");
    this.name = "ConsultationPaymentWebhookNotActionableError";
  }
}

export class ConsultationPaymentWebhookValidationError extends Error {
  constructor() {
    super("The webhook event does not match the server-owned payment record.");
    this.name = "ConsultationPaymentWebhookValidationError";
  }
}

function isObject(value: Prisma.JsonValue | undefined): value is Prisma.JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getStoredWebhookEvent(verificationPayload: Prisma.JsonValue | null): StoredWebhookEvent | null {
  if (!isObject(verificationPayload)) {
    return null;
  }

  if (!("providerWebhook" in verificationPayload)) {
    return null;
  }

  const storedEvent = verificationPayload.providerWebhook;

  if (!isObject(storedEvent)) {
    throw new PaymentVerificationConflictError();
  }

  const {
    eventId,
    outcome,
    provider,
    classification,
    failureCode,
    retryAfterSeconds
  } = storedEvent;

  if (
    typeof eventId !== "string" ||
    (outcome !== "verified" &&
      outcome !== "rejected" &&
      outcome !== "provider_error") ||
    (provider !== "slipok" && provider !== "easyslip")
  ) {
    throw new PaymentVerificationConflictError();
  }

  return {
    eventId,
    outcome,
    provider,
    classification: typeof classification === "string" ? classification : null,
    failureCode: typeof failureCode === "string" ? failureCode : null,
    retryAfterSeconds:
      typeof retryAfterSeconds === "number" &&
      Number.isInteger(retryAfterSeconds) &&
      retryAfterSeconds > 0
        ? retryAfterSeconds
        : null
  };
}

function getWebhookOutcome(event: ActionableConsultationPaymentWebhookEvent): WebhookOutcome {
  return event.eventType === "consultation.payment.verified"
    ? "verified"
    : event.eventType === "consultation.payment.rejected"
      ? "rejected"
      : "provider_error";
}

function isExactReplay(
  storedEvent: StoredWebhookEvent,
  event: ActionableConsultationPaymentWebhookEvent,
  paymentStatus: PaymentStatus,
  serverAmount: number,
  normalizedTransactionReference: string | null,
  consultationStatus: ConsultationStatus
): boolean {
  const outcome = getWebhookOutcome(event);
  const paymentMatchesOutcome =
    outcome === "verified"
      ? paymentStatus === "verified" || paymentStatus === "refunded"
      : outcome === "rejected"
        ? paymentStatus === "rejected"
        : paymentStatus === "pending_review";
  const consultationMatchesOutcome =
    outcome === "verified"
      ? ["scheduled", "live", "completed", "cancelled"].includes(consultationStatus)
      : outcome === "rejected"
        ? consultationStatus === "pending_payment" || consultationStatus === "cancelled"
        : consultationStatus === "pending_payment";
  const amountMatches =
    Number.isFinite(serverAmount) && toSatang(serverAmount) === toSatang(event.amount);
  let transactionReferenceMatches = outcome !== "verified";

  if (outcome === "verified" && event.eventType === "consultation.payment.verified") {
    try {
      transactionReferenceMatches =
        normalizePaymentTransactionReference(event.transactionReference) ===
        normalizedTransactionReference;
    } catch {
      transactionReferenceMatches = false;
    }
  }

  return (
    paymentMatchesOutcome &&
    consultationMatchesOutcome &&
    amountMatches &&
    transactionReferenceMatches &&
    storedEvent.eventId === event.eventId &&
    storedEvent.outcome === outcome &&
    storedEvent.provider === event.provider &&
    storedEvent.classification ===
      (event.eventType === "consultation.payment.verified" ? null : event.classification) &&
    storedEvent.failureCode ===
      (event.eventType === "consultation.payment.verified" ? null : event.failureCode) &&
    storedEvent.retryAfterSeconds ===
      (event.eventType === "consultation.payment.provider_error"
        ? event.retryAfterSeconds
        : null)
  );
}

function toSatang(value: number): number {
  return Math.round(value * 100);
}

function getVerificationResult(
  event: ActionableConsultationPaymentWebhookEvent,
  serverAmount: number
): SlipVerificationResult {
  if (event.eventType === "consultation.payment.provider_error") {
    throw new PaymentVerificationConflictError();
  }
  const verified = event.eventType === "consultation.payment.verified";

  return {
    ok: verified,
    provider: event.provider,
    status: verified ? "verified" : "rejected",
    transRef: verified ? event.transactionReference : null,
    amount: verified ? serverAmount : null,
    receiverName: null,
    transactionTimestamp: null,
    failure: verified
      ? null
      : {
          classification: event.classification,
          code: event.failureCode,
          retryAfterSeconds: null,
          retryGuidance: "correct_evidence"
        },
    raw: null
  };
}

export async function persistConsultationPaymentWebhookEvent(
  tx: Prisma.TransactionClient,
  event: ActionableConsultationPaymentWebhookEvent
): Promise<ConsultationPaymentWebhookPersistenceResult> {
  const paymentReference = await tx.payment.findUnique({
    where: { id: event.paymentId },
    select: { consultationId: true }
  });

  if (!paymentReference?.consultationId) {
    throw new ConsultationPaymentWebhookNotActionableError();
  }

  // Follow the same lock ordering as the existing consultation verification
  // service: consultation first, then its one-to-one payment.
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${paymentReference.consultationId} FOR UPDATE`
  );
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Payment\` WHERE \`id\` = ${event.paymentId} FOR UPDATE`
  );

  const payment = await tx.payment.findUnique({
    where: { id: event.paymentId },
    select: {
      id: true,
      amount: true,
      status: true,
      normalizedTransactionReference: true,
      updatedAt: true,
      verificationPayload: true,
      consultation: {
        select: {
          id: true,
          patientId: true,
          status: true
        }
      }
    }
  });

  if (!payment?.consultation || payment.consultation.id !== paymentReference.consultationId) {
    throw new ConsultationPaymentWebhookNotActionableError();
  }

  const storedEvent = getStoredWebhookEvent(payment.verificationPayload);
  const serverAmount = Number(payment.amount);

  if (storedEvent?.eventId === event.eventId) {
    if (
      isExactReplay(
        storedEvent,
        event,
        payment.status,
        serverAmount,
        payment.normalizedTransactionReference,
        payment.consultation.status
      )
    ) {
      return "replayed";
    }

    throw new PaymentVerificationConflictError();
  }

  if (payment.status !== "pending_review" || payment.consultation.status !== "pending_payment") {
    throw new PaymentVerificationConflictError();
  }

  if (!Number.isFinite(serverAmount) || toSatang(serverAmount) !== toSatang(event.amount)) {
    throw new ConsultationPaymentWebhookValidationError();
  }

  const outcome = getWebhookOutcome(event);
  const failure =
    event.eventType === "consultation.payment.verified"
      ? null
      : {
          classification: event.classification,
          code: event.failureCode,
          retryAfterSeconds:
            event.eventType === "consultation.payment.provider_error"
              ? event.retryAfterSeconds
              : null,
          retryGuidance:
            event.eventType === "consultation.payment.provider_error" &&
            event.classification === "provider_delay"
              ? "retry_after_provider_delay"
              : event.eventType === "consultation.payment.provider_error"
                ? "independent_bank_confirmation"
                : "correct_evidence"
        } as const;
  const failedAt = new Date();
  const eventClaim = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: "pending_review",
      updatedAt: payment.updatedAt
    },
    data: {
      verificationPayload: mergePaymentVerificationPayload(payment.verificationPayload, {
        providerWebhook: {
          eventId: event.eventId,
          outcome,
          provider: event.provider,
          classification: failure?.classification ?? null,
          failureCode: failure?.code ?? null,
          retryAfterSeconds: failure?.retryAfterSeconds ?? null
        },
        ...(event.eventType === "consultation.payment.provider_error"
          ? {
              providerAttempt: {
                failedAt: failedAt.toISOString(),
                failure,
                outcome: "provider_error",
                provider: event.provider,
                source: "provider_webhook",
                eventId: event.eventId
              }
            }
          : {})
      })
    }
  });

  if (eventClaim.count !== 1) {
    throw new PaymentVerificationConflictError();
  }

  if (event.eventType === "consultation.payment.provider_error") {
    await writeAuditLog(tx, {
      actorId: null,
      action: "consultation.payment_provider_unavailable",
      entityType: "consultation",
      entityId: payment.consultation.id,
      metadata: {
        paymentId: payment.id,
        provider: event.provider,
        failureClassification: event.classification,
        failureCode: event.failureCode,
        retryAfterSeconds: event.retryAfterSeconds,
        source: "provider_webhook",
        paymentStatus: "pending_review",
        consultationStatus: "pending_payment"
      }
    });
    return "processed";
  }

  const consultation: ConsultationPaymentSnapshot = {
    id: payment.consultation.id,
    patientId: payment.consultation.patientId,
    status: payment.consultation.status
  };

  await applyConsultationPaymentVerification(tx, {
    actorId: null,
    consultation,
    evidence: {
      amount: serverAmount,
      source: "provider_webhook"
    },
    result: getVerificationResult(event, serverAmount)
  });

  return "processed";
}
