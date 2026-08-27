import { Prisma, type ConsultationStatus, type PaymentStatus } from "@prisma/client";
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

type WebhookOutcome = "verified" | "rejected";

type StoredWebhookEvent = {
  eventId: string;
  outcome: WebhookOutcome;
  provider: "slipok" | "easyslip";
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

  const { eventId, outcome, provider } = storedEvent;

  if (
    typeof eventId !== "string" ||
    (outcome !== "verified" && outcome !== "rejected") ||
    (provider !== "slipok" && provider !== "easyslip")
  ) {
    throw new PaymentVerificationConflictError();
  }

  return { eventId, outcome, provider };
}

function getWebhookOutcome(event: ActionableConsultationPaymentWebhookEvent): WebhookOutcome {
  return event.eventType === "consultation.payment.verified" ? "verified" : "rejected";
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
      : paymentStatus === "rejected";
  const consultationMatchesOutcome =
    outcome === "verified"
      ? ["scheduled", "live", "completed", "cancelled"].includes(consultationStatus)
      : consultationStatus === "pending_payment" || consultationStatus === "cancelled";
  const amountMatches =
    Number.isFinite(serverAmount) && toSatang(serverAmount) === toSatang(event.amount);
  let transactionReferenceMatches = outcome === "rejected";

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
    storedEvent.provider === event.provider
  );
}

function toSatang(value: number): number {
  return Math.round(value * 100);
}

function getVerificationResult(
  event: ActionableConsultationPaymentWebhookEvent,
  serverAmount: number
): SlipVerificationResult {
  const verified = event.eventType === "consultation.payment.verified";

  return {
    ok: verified,
    provider: event.provider,
    status: verified ? "verified" : "rejected",
    transRef: verified ? event.transactionReference : null,
    amount: verified ? serverAmount : null,
    receiverName: null,
    transactionTimestamp: null,
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
          provider: event.provider
        }
      })
    }
  });

  if (eventClaim.count !== 1) {
    throw new PaymentVerificationConflictError();
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
