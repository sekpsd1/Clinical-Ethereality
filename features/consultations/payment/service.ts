import { Prisma, type ConsultationStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";
import {
  DuplicatePaymentTransactionError,
  getPersistableProviderResult,
  mergePaymentVerificationPayload,
  PaymentVerificationConflictError,
  PaymentVerificationRateLimitError,
  ProviderVerificationUnavailableError
} from "@/features/payments/service";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";

export type ConsultationPaymentVerificationTransition = {
  auditAction: "consultation.payment_verified" | "consultation.payment_rejected";
  nextStatus: ConsultationStatus | null;
  shouldNotifyPatient: boolean;
};

export type ConsultationPaymentSnapshot = {
  id: string;
  patientId: string;
  status: ConsultationStatus;
};

export type ConsultationPaymentEvidence = {
  amount: number;
  attachmentId?: string;
  qrPayload?: string;
  slipImageUrl?: string;
  source?: "provider_webhook";
};

const consultationPaymentVerificationTransitions: Record<
  "verified" | "rejected",
  ConsultationPaymentVerificationTransition
> = {
  verified: {
    auditAction: "consultation.payment_verified",
    nextStatus: "scheduled",
    shouldNotifyPatient: true
  },
  rejected: {
    auditAction: "consultation.payment_rejected",
    nextStatus: null,
    shouldNotifyPatient: false
  }
};

export function getConsultationPaymentVerificationTransition(
  ok: boolean
): ConsultationPaymentVerificationTransition {
  return consultationPaymentVerificationTransitions[ok ? "verified" : "rejected"];
}

export function assertConsultationReadyForPaymentVerification(status: ConsultationStatus) {
  if (status !== "pending_payment") {
    throw new Error("Consultation is not ready for payment verification.");
  }
}

function getProviderAttemptedAt(verificationPayload: Prisma.JsonValue | null): Date | null {
  if (!verificationPayload || typeof verificationPayload !== "object" || Array.isArray(verificationPayload)) {
    return null;
  }

  const providerAttempt = (verificationPayload as Prisma.JsonObject).providerAttempt;

  if (!providerAttempt || typeof providerAttempt !== "object" || Array.isArray(providerAttempt)) {
    return null;
  }

  const claimedAt = (providerAttempt as Prisma.JsonObject).claimedAt;

  if (typeof claimedAt !== "string") {
    return null;
  }

  const parsed = new Date(claimedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function hasAdminManualAppointmentIntake(
  verificationPayload: Prisma.JsonValue | null
): boolean {
  if (
    !verificationPayload ||
    typeof verificationPayload !== "object" ||
    Array.isArray(verificationPayload)
  ) {
    return false;
  }

  const intake = (verificationPayload as Prisma.JsonObject).manualAppointmentIntake;

  return Boolean(
    intake &&
      typeof intake === "object" &&
      !Array.isArray(intake) &&
      (intake as Prisma.JsonObject).version === 1 &&
      (intake as Prisma.JsonObject).source === "admin_manual_appointment"
  );
}

export function getConsultationPaymentVerificationRetryAfterSeconds(
  payment: { status: string; verificationPayload: Prisma.JsonValue | null },
  now = new Date()
): number {
  if (payment.status !== "pending_review") {
    return 0;
  }

  const attemptedAt = getProviderAttemptedAt(payment.verificationPayload);

  if (!attemptedAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((attemptedAt.getTime() + 30_000 - now.getTime()) / 1000));
}

export async function claimConsultationProviderVerification(
  tx: Prisma.TransactionClient,
  input: { actorId: string; consultation: ConsultationPaymentSnapshot }
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${input.consultation.id} FOR UPDATE`
  );

  const currentConsultation = await tx.consultation.findUnique({
    where: { id: input.consultation.id },
    select: { patientId: true, status: true }
  });

  if (
    !currentConsultation ||
    currentConsultation.patientId !== input.consultation.patientId ||
    currentConsultation.status !== "pending_payment"
  ) {
    throw new PaymentVerificationConflictError();
  }

  const payment = await tx.payment.findUnique({
    where: { consultationId: input.consultation.id },
    select: { id: true, status: true, updatedAt: true, verificationPayload: true }
  });

  if (!payment || payment.status !== "pending_review") {
    throw new PaymentVerificationConflictError();
  }

  if (hasAdminManualAppointmentIntake(payment.verificationPayload)) {
    throw new PaymentVerificationConflictError();
  }

  const retryAfterSeconds = getConsultationPaymentVerificationRetryAfterSeconds(payment);

  if (retryAfterSeconds > 0) {
    throw new PaymentVerificationRateLimitError(retryAfterSeconds);
  }

  const claimedAt = new Date();
  const paymentUpdate = await tx.payment.updateMany({
    where: { id: payment.id, status: "pending_review", updatedAt: payment.updatedAt },
    data: {
      verificationPayload: mergePaymentVerificationPayload(payment.verificationPayload, {
        providerAttempt: {
          claimedAt: claimedAt.toISOString(),
          claimedBy: input.actorId,
          status: "pending_review"
        }
      }),
      updatedAt: claimedAt
    }
  });

  if (paymentUpdate.count !== 1) {
    throw new PaymentVerificationConflictError();
  }
}

export async function applyConsultationPaymentVerification(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string | null;
    consultation: ConsultationPaymentSnapshot;
    evidence: ConsultationPaymentEvidence;
    result: SlipVerificationResult;
  }
) {
  assertConsultationReadyForPaymentVerification(input.consultation.status);

  if (input.result.status === "provider_error") {
    throw new ProviderVerificationUnavailableError();
  }

  if (input.result.ok !== (input.result.status === "verified")) {
    throw new Error("Provider verification status does not match its success result.");
  }

  if (input.result.ok && !input.result.transRef) {
    throw new Error("A verified consultation payment must include a transaction reference.");
  }

  const transition = getConsultationPaymentVerificationTransition(input.result.ok);
  const reviewedAt = new Date();
  const normalizedTransactionReference = input.result.ok
    ? normalizePaymentTransactionReference(input.result.transRef ?? "")
    : null;

  // Serialize by consultation so concurrent evidence submissions cannot create
  // two completed payments or schedule the same consultation twice.
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${input.consultation.id} FOR UPDATE`
  );

  const currentConsultation = await tx.consultation.findUnique({
    where: {
      id: input.consultation.id
    },
    select: {
      patientId: true,
      doctorId: true,
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
      }
    }
  });

  if (
    !currentConsultation ||
    currentConsultation.patientId !== input.consultation.patientId ||
    currentConsultation.status !== "pending_payment"
  ) {
    throw new PaymentVerificationConflictError();
  }

  const existingPayment = await tx.payment.findUnique({
    where: {
      consultationId: input.consultation.id
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      verificationPayload: true
    }
  });

  if (hasAdminManualAppointmentIntake(existingPayment?.verificationPayload ?? null)) {
    throw new PaymentVerificationConflictError();
  }

  if (existingPayment?.status === "verified" || existingPayment?.status === "refunded") {
    throw new PaymentVerificationConflictError();
  }

  if (normalizedTransactionReference) {
    const duplicatePayment = await tx.payment.findFirst({
      where: {
        id: {
          not: existingPayment?.id ?? ""
        },
        status: {
          in: ["verified", "refunded"]
        },
        normalizedTransactionReference
      },
      select: {
        id: true
      }
    });

    if (duplicatePayment) {
      throw new DuplicatePaymentTransactionError();
    }
  }

  const verificationPayload = mergePaymentVerificationPayload(existingPayment?.verificationPayload ?? null, {
    reviewedAt: reviewedAt.toISOString(),
    source: input.result.provider,
    result: toJsonValue(getPersistableProviderResult(input.result)),
    submittedEvidence:
      input.evidence.source === "provider_webhook"
        ? { type: "provider_webhook" }
        : input.evidence.attachmentId
          ? { type: "private_file", attachmentId: input.evidence.attachmentId }
          : input.evidence.qrPayload
            ? { type: "qr_payload" }
            : { type: "image_url" }
  });
  const slotIsActive = Boolean(
    currentConsultation.slotLock &&
      currentConsultation.slotLock.id === currentConsultation.slotLockId &&
      currentConsultation.slotLock.doctorId === currentConsultation.doctorId &&
      currentConsultation.slotLock.patientId === input.consultation.patientId &&
      currentConsultation.scheduledAt &&
      currentConsultation.slotLock.scheduledAt.getTime() ===
        currentConsultation.scheduledAt.getTime() &&
      (!currentConsultation.slotLock.expiresAt ||
        currentConsultation.slotLock.expiresAt > reviewedAt)
  );
  const nextConsultationStatus = input.result.ok
    ? slotIsActive
      ? "scheduled"
      : "reschedule_required"
    : null;

  try {
    if (existingPayment) {
      const paymentUpdate = await tx.payment.updateMany({
        where: {
          id: existingPayment.id,
          status: existingPayment.status,
          updatedAt: existingPayment.updatedAt
        },
        data: {
          amount: input.evidence.amount,
          status: input.result.ok ? "verified" : "rejected",
          qrPayload: input.evidence.qrPayload,
          slipImageUrl: input.evidence.slipImageUrl,
          normalizedTransactionReference,
          reviewedAt,
          verificationPayload
        }
      });

      if (paymentUpdate.count !== 1) {
        throw new PaymentVerificationConflictError();
      }
    } else {
      await tx.payment.create({
        data: {
          consultationId: input.consultation.id,
          amount: input.evidence.amount,
          status: input.result.ok ? "verified" : "rejected",
          qrPayload: input.evidence.qrPayload,
          slipImageUrl: input.evidence.slipImageUrl,
          normalizedTransactionReference,
          reviewedAt,
          verificationPayload
        }
      });
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002") {
      throw new DuplicatePaymentTransactionError();
    }

    throw error;
  }

  if (nextConsultationStatus) {
    const consultationUpdate = await tx.consultation.updateMany({
      where: {
        id: input.consultation.id,
        status: "pending_payment"
      },
      data:
        nextConsultationStatus === "scheduled"
          ? { status: "scheduled" }
          : { status: "reschedule_required", slotLockId: null }
    });

    if (consultationUpdate.count !== 1) {
      throw new PaymentVerificationConflictError();
    }

    if (nextConsultationStatus === "reschedule_required" && currentConsultation.slotLockId) {
      await tx.consultationSlotLock.deleteMany({
        where: { id: currentConsultation.slotLockId }
      });
    }
  }

  if (transition.shouldNotifyPatient) {
    await tx.notification.create({
      data: {
        userId: input.consultation.patientId,
        type: "consultation",
        channel: "in_app",
        title: nextConsultationStatus === "scheduled" ? "ยืนยันการชำระค่าปรึกษาแล้ว" : "ยืนยันการชำระเงินแล้ว กรุณาเลือกเวลาใหม่",
        body: nextConsultationStatus === "scheduled" ? "นัดหมายของคุณได้รับการยืนยันแล้ว กรุณาเปิดห้องรอก่อนเวลานัด" : "เวลานัดเดิมถูกปล่อยคืนแล้ว เลือกเวลาใหม่ของแพทย์เดิมโดยไม่ต้องชำระซ้ำ",
        metadataJson: {
          consultationId: input.consultation.id,
          href: nextConsultationStatus === "scheduled" ? `/consult/appointments/${input.consultation.id}` : `/consult/booking/somchai?doctorId=${currentConsultation.doctorId}&reschedule=${input.consultation.id}`
        }
      }
    });

    if (nextConsultationStatus === "scheduled") {
      await tx.notification.create({
        data: {
          userId: currentConsultation.doctor.userId,
          type: "consultation",
          channel: "in_app",
          title: "มีนัดหมายปรึกษาใหม่",
          body: "การชำระเงินได้รับการยืนยันแล้ว กรุณาตรวจคิวปรึกษา",
          metadataJson: {
            consultationId: input.consultation.id,
            href: "/doctor/consultations"
          }
        }
      });
    }
  }

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: transition.auditAction,
    entityType: "consultation",
    entityId: input.consultation.id,
    metadata: {
      previousStatus: input.consultation.status,
      nextStatus: nextConsultationStatus ?? input.consultation.status,
      provider: input.result.provider,
      status: input.result.status,
      transactionReferenceRecorded: Boolean(normalizedTransactionReference),
      amountMatched: input.result.ok,
      receiverMatched: input.result.ok,
      slotOutcome: input.result.ok ? (slotIsActive ? "retained" : "released") : "unchanged"
    }
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
