import { Prisma, type ConsultationStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";
import {
  DuplicatePaymentTransactionError,
  getPersistableProviderResult,
  PaymentVerificationConflictError,
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
  qrPayload?: string;
  slipImageUrl?: string;
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

export async function applyConsultationPaymentVerification(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
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
      status: true
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
      updatedAt: true
    }
  });

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

  const verificationPayload = {
    reviewedAt: reviewedAt.toISOString(),
    source: input.result.provider,
    result: toJsonValue(getPersistableProviderResult(input.result))
  };

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

  if (transition.nextStatus) {
    const consultationUpdate = await tx.consultation.updateMany({
      where: {
        id: input.consultation.id,
        status: "pending_payment"
      },
      data: {
        status: transition.nextStatus
      }
    });

    if (consultationUpdate.count !== 1) {
      throw new PaymentVerificationConflictError();
    }
  }

  if (transition.shouldNotifyPatient) {
    await tx.notification.create({
      data: {
        userId: input.consultation.patientId,
        type: "consultation",
        channel: "in_app",
        title: "ยืนยันการชำระค่าปรึกษาแล้ว",
        body: "นัดหมายของคุณได้รับการยืนยันแล้ว กรุณาเปิดห้องรอก่อนเวลานัด",
        metadataJson: {
          consultationId: input.consultation.id,
          href: `/consult/appointments/${input.consultation.id}`
        }
      }
    });
  }

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: transition.auditAction,
    entityType: "consultation",
    entityId: input.consultation.id,
    metadata: {
      previousStatus: input.consultation.status,
      nextStatus: transition.nextStatus ?? input.consultation.status,
      provider: input.result.provider,
      status: input.result.status,
      transactionReferenceRecorded: Boolean(normalizedTransactionReference),
      amountMatched: input.result.ok,
      receiverMatched: input.result.ok
    }
  });
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
