import type { ConsultationStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";

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
    result: SlipVerificationResult;
  }
) {
  assertConsultationReadyForPaymentVerification(input.consultation.status);

  const transition = getConsultationPaymentVerificationTransition(input.result.ok);

  if (transition.nextStatus) {
    await tx.consultation.update({
      where: {
        id: input.consultation.id
      },
      data: {
        status: transition.nextStatus
      }
    });
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
          href: `/consult/appointments/${input.consultation.id}`,
          provider: input.result.provider,
          transRef: input.result.transRef
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
      transRef: input.result.transRef,
      amount: input.result.amount,
      receiverName: input.result.receiverName
    }
  });
}
