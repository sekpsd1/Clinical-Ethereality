import { Prisma, type ConsultationStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { mergePaymentVerificationPayload } from "@/features/payments/service";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";
import { paymentSlipEntityType } from "@/features/payments/private-slips";

export const CONSULTATION_MANUAL_REVIEW_CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const consultationManualReviewReasonCodes = [
  "provider_unavailable",
  "provider_timeout",
  "provider_result_ambiguous"
] as const;

export type ConsultationManualReviewReasonCode =
  (typeof consultationManualReviewReasonCodes)[number];

export class ConsultationManualReviewError extends Error {
  constructor(
    readonly code:
      | "NOT_ELIGIBLE"
      | "INVALID_AMOUNT"
      | "INVALID_TRANSFER_TIME"
      | "INVALID_CONTACT_WINDOW"
      | "MISSING_EVIDENCE"
      | "DUPLICATE_REFERENCE"
      | "CONFLICT"
  ) {
    super(code);
    this.name = "ConsultationManualReviewError";
  }
}

function asJsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getConsultationProviderFailureAt(
  payload: Prisma.JsonValue | null
): Date | null {
  const attempt = asJsonObject(payload).providerAttempt;
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) return null;
  const object = attempt as Prisma.JsonObject;
  if (object.outcome !== "provider_error") return null;
  return parseDate(object.failedAt);
}

export function isConsultationManualReviewContactEligible(input: {
  customerReportedAt: Date;
  providerFailureAt: Date;
}): boolean {
  const delta = input.customerReportedAt.getTime() - input.providerFailureAt.getTime();
  return delta >= 0 && delta <= CONSULTATION_MANUAL_REVIEW_CONTACT_WINDOW_MS;
}

export async function recordConsultationProviderFailure(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    consultationId: string;
    provider: "slipok" | "easyslip" | "unknown";
  }
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${input.consultationId} FOR UPDATE`
  );
  const consultation = await tx.consultation.findUnique({
    where: { id: input.consultationId },
    select: {
      id: true,
      patientId: true,
      status: true,
      payment: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          verificationPayload: true
        }
      }
    }
  });

  if (
    !consultation ||
    consultation.patientId !== input.actorId ||
    consultation.status !== "pending_payment" ||
    consultation.payment?.status !== "pending_review"
  ) {
    return;
  }

  const failedAt = new Date();
  const payload = asJsonObject(consultation.payment.verificationPayload);
  const existingAttempt = asJsonObject(
    payload.providerAttempt as Prisma.JsonValue | null
  );
  const updated = await tx.payment.updateMany({
    where: {
      id: consultation.payment.id,
      status: "pending_review",
      updatedAt: consultation.payment.updatedAt
    },
    data: {
      verificationPayload: mergePaymentVerificationPayload(
        consultation.payment.verificationPayload,
        {
          providerAttempt: {
            ...existingAttempt,
            failedAt: failedAt.toISOString(),
            outcome: "provider_error",
            provider: input.provider
          }
        }
      )
    }
  });

  if (updated.count !== 1) return;

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "consultation.payment_provider_unavailable",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      paymentId: consultation.payment.id,
      provider: input.provider,
      paymentStatus: "pending_review",
      consultationStatus: "pending_payment"
    }
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
  );
}

export type ManualConsultationReviewOutcome =
  | "scheduled"
  | "reschedule_required"
  | "already_processed";

export async function applyManualConsultationPaymentReview(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    amount: string;
    customerReportedAt: Date;
    paymentId: string;
    reasonCode: ConsultationManualReviewReasonCode;
    transactionReference: string;
    transferredAt: Date;
  },
  now = new Date()
): Promise<ManualConsultationReviewOutcome> {
  const normalizedReference = normalizePaymentTransactionReference(
    input.transactionReference
  );
  const submittedAmount = new Prisma.Decimal(input.amount);

  const paymentLookup = await tx.payment.findUnique({
    where: { id: input.paymentId },
    select: { consultationId: true }
  });
  if (!paymentLookup?.consultationId) {
    throw new ConsultationManualReviewError("NOT_ELIGIBLE");
  }

  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${paymentLookup.consultationId} FOR UPDATE`
  );
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Payment\` WHERE \`id\` = ${input.paymentId} FOR UPDATE`
  );
  const consultation = await tx.consultation.findUnique({
    where: { id: paymentLookup.consultationId },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      createdAt: true,
      scheduledAt: true,
      slotLockId: true,
      status: true,
      doctor: { select: { userId: true } },
      slotLock: {
        select: {
          id: true,
          doctorId: true,
          patientId: true,
          scheduledAt: true,
          expiresAt: true
        }
      },
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          updatedAt: true,
          normalizedTransactionReference: true,
          reviewedById: true,
          verificationPayload: true
        }
      }
    }
  });

  if (!consultation?.payment || consultation.payment.id !== input.paymentId) {
    throw new ConsultationManualReviewError("NOT_ELIGIBLE");
  }

  const payment = consultation.payment;
  const priorManualReview = asJsonObject(payment.verificationPayload).manualReview;
  if (
    payment.status === "verified" &&
    payment.normalizedTransactionReference === normalizedReference &&
    priorManualReview &&
    typeof priorManualReview === "object" &&
    !Array.isArray(priorManualReview) &&
    (priorManualReview as Prisma.JsonObject).verificationSource ===
      "line_oa_external_bank"
  ) {
    return "already_processed";
  }

  if (
    payment.status !== "pending_review" ||
    (consultation.status !== "pending_payment" &&
      consultation.status !== "reschedule_required")
  ) {
    throw new ConsultationManualReviewError("NOT_ELIGIBLE");
  }

  const providerFailureAt = getConsultationProviderFailureAt(
    payment.verificationPayload
  );
  if (!providerFailureAt) {
    throw new ConsultationManualReviewError("NOT_ELIGIBLE");
  }
  if (
    !isConsultationManualReviewContactEligible({
      customerReportedAt: input.customerReportedAt,
      providerFailureAt
    }) ||
    input.customerReportedAt > now
  ) {
    throw new ConsultationManualReviewError("INVALID_CONTACT_WINDOW");
  }
  if (
    input.transferredAt > now ||
    input.transferredAt < consultation.createdAt
  ) {
    throw new ConsultationManualReviewError("INVALID_TRANSFER_TIME");
  }
  if (!submittedAmount.equals(payment.amount)) {
    throw new ConsultationManualReviewError("INVALID_AMOUNT");
  }

  const attachment = await tx.fileAttachment.findFirst({
    where: {
      entityId: payment.id,
      entityType: paymentSlipEntityType,
      ownerId: consultation.patientId,
      purpose: "payment_slip",
      status: "attached",
      storageKey: { not: null }
    },
    select: { id: true }
  });
  if (!attachment) {
    throw new ConsultationManualReviewError("MISSING_EVIDENCE");
  }

  const duplicate = await tx.payment.findFirst({
    where: {
      id: { not: payment.id },
      normalizedTransactionReference: normalizedReference,
      status: { in: ["verified", "refunded"] }
    },
    select: { id: true }
  });
  if (duplicate) {
    throw new ConsultationManualReviewError("DUPLICATE_REFERENCE");
  }

  const hasActiveSlot = Boolean(
    consultation.status === "pending_payment" &&
      consultation.scheduledAt &&
      consultation.slotLock &&
      consultation.slotLock.id === consultation.slotLockId &&
      consultation.slotLock.doctorId === consultation.doctorId &&
      consultation.slotLock.patientId === consultation.patientId &&
      consultation.slotLock.scheduledAt.getTime() ===
        consultation.scheduledAt.getTime() &&
      (!consultation.slotLock.expiresAt || consultation.slotLock.expiresAt > now)
  );
  const nextConsultationStatus: ConsultationStatus = hasActiveSlot
    ? "scheduled"
    : "reschedule_required";

  try {
    const updatedPayment = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: "pending_review",
        updatedAt: payment.updatedAt
      },
      data: {
        status: "verified",
        normalizedTransactionReference: normalizedReference,
        reviewedById: input.actorId,
        reviewedAt: now,
        verificationPayload: mergePaymentVerificationPayload(
          payment.verificationPayload,
          {
            manualReview: {
              attachmentId: attachment.id,
              customerReportedAt: input.customerReportedAt.toISOString(),
              providerFailureAt: providerFailureAt.toISOString(),
              reasonCode: input.reasonCode,
              reviewedAt: now.toISOString(),
              transferredAt: input.transferredAt.toISOString(),
              verificationSource: "line_oa_external_bank"
            }
          }
        )
      }
    });
    if (updatedPayment.count !== 1) {
      throw new ConsultationManualReviewError("CONFLICT");
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConsultationManualReviewError("DUPLICATE_REFERENCE");
    }
    throw error;
  }

  const updatedConsultation = await tx.consultation.updateMany({
    where: {
      id: consultation.id,
      status: consultation.status,
      slotLockId: consultation.slotLockId
    },
    data: hasActiveSlot
      ? { status: "scheduled" }
      : { status: "reschedule_required", slotLockId: null }
  });
  if (updatedConsultation.count !== 1) {
    throw new ConsultationManualReviewError("CONFLICT");
  }

  if (!hasActiveSlot && consultation.slotLockId) {
    await tx.consultationSlotLock.deleteMany({
      where: { id: consultation.slotLockId }
    });
  }

  await tx.notification.create({
    data: {
      userId: consultation.patientId,
      type: "consultation",
      channel: "in_app",
      title: hasActiveSlot
        ? "ยืนยันการชำระค่าปรึกษาแล้ว"
        : "ยืนยันการชำระเงินแล้ว กรุณาเลือกเวลาใหม่",
      body: hasActiveSlot
        ? "แอดมินตรวจรายการโอนและยืนยันนัดหมายของคุณแล้ว"
        : "เวลานัดเดิมถูกปล่อยคืนแล้ว เลือกเวลาใหม่ของแพทย์เดิมโดยไม่ต้องชำระซ้ำ",
      metadataJson: {
        consultationId: consultation.id,
        paymentId: payment.id,
        href: hasActiveSlot
          ? `/consult/appointments/${consultation.id}`
          : `/consult/booking/somchai?doctorId=${consultation.doctorId}&reschedule=${consultation.id}`
      }
    }
  });

  if (hasActiveSlot) {
    await tx.notification.create({
      data: {
        userId: consultation.doctor.userId,
        type: "consultation",
        channel: "in_app",
        title: "มีนัดหมายปรึกษาใหม่",
        body: "การชำระเงินได้รับการยืนยันแล้ว กรุณาตรวจคิวปรึกษา",
        metadataJson: {
          consultationId: consultation.id,
          href: "/doctor/consultations"
        }
      }
    });
  }

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "consultation.payment_manual_review",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      paymentId: payment.id,
      previousPaymentStatus: "pending_review",
      nextPaymentStatus: "verified",
      previousConsultationStatus: consultation.status,
      nextConsultationStatus,
      amount: payment.amount.toFixed(2),
      transferredAt: input.transferredAt.toISOString(),
      customerReportedAt: input.customerReportedAt.toISOString(),
      providerFailureAt: providerFailureAt.toISOString(),
      reasonCode: input.reasonCode,
      verificationSource: "line_oa_external_bank",
      transactionReferenceRecorded: true,
      slotOutcome: hasActiveSlot ? "retained" : "released"
    }
  });

  return hasActiveSlot ? "scheduled" : "reschedule_required";
}
