import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  getConsultationProviderFailureAt,
  getManualAppointmentIntake
} from "@/features/consultations/payment/manual-review";

export type SlotLockReleaseResult = {
  expiredConsultations: number;
  deletedOrphanLocks: number;
};

export async function releaseExpiredConsultationSlotLocks(now = new Date()): Promise<SlotLockReleaseResult> {
  return prisma.$transaction(async (tx) => {
    const lockedConsultations = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT c.\`id\`
        FROM \`Consultation\` c
        INNER JOIN \`ConsultationSlotLock\` l ON l.\`id\` = c.\`slotLockId\`
        WHERE c.\`status\` = 'pending_payment'
          AND l.\`expiresAt\` <= ${now}
        FOR UPDATE
      `
    );
    const lockedIds = lockedConsultations.map((consultation) => consultation.id);
    const expiredConsultations = await tx.consultation.findMany({
      where: {
        id: { in: lockedIds },
        status: "pending_payment"
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        scheduledAt: true,
        slotLockId: true,
        payment: {
          select: {
            status: true,
            verificationPayload: true
          }
        }
      }
    });

    const lockIds = expiredConsultations.flatMap((consultation) => (consultation.slotLockId ? [consultation.slotLockId] : []));
    const manualReviewCandidates = expiredConsultations.filter(
      (consultation) =>
        consultation.payment?.status === "pending_review" &&
        Boolean(
          getConsultationProviderFailureAt(
            consultation.payment.verificationPayload
          ) ||
            getManualAppointmentIntake(
              consultation.payment.verificationPayload
            )
        )
    );
    const cancelledConsultations = expiredConsultations.filter(
      (consultation) =>
        !manualReviewCandidates.some((candidate) => candidate.id === consultation.id)
    );

    if (manualReviewCandidates.length > 0) {
      await tx.consultation.updateMany({
        where: {
          id: {
            in: manualReviewCandidates.map((consultation) => consultation.id)
          },
          status: "pending_payment"
        },
        data: {
          status: "reschedule_required",
          slotLockId: null
        }
      });

      await tx.notification.createMany({
        data: manualReviewCandidates.map((consultation) => ({
          userId: consultation.patientId,
          type: "consultation" as const,
          channel: "in_app" as const,
          title: "เวลาจองถูกปล่อยคืนแล้ว",
          body: "ทีมงานยังตรวจรายการโอนของคุณอยู่ หากยืนยันแล้วระบบจะแจ้งให้เลือกเวลาใหม่",
          metadataJson: {
            consultationId: consultation.id,
            href: `/consult/appointments/${consultation.id}`,
            scheduledAt: consultation.scheduledAt?.toISOString() ?? null
          }
        }))
      });
    }

    if (cancelledConsultations.length > 0) {
      await tx.consultation.updateMany({
        where: {
          id: {
            in: cancelledConsultations.map((consultation) => consultation.id)
          },
          status: "pending_payment"
        },
        data: {
          status: "cancelled",
          slotLockId: null
        }
      });

      await tx.notification.createMany({
        data: cancelledConsultations.map((consultation) => ({
          userId: consultation.patientId,
          type: "consultation",
          channel: "in_app",
          title: "เวลาจองหมดอายุ",
          body: "ระบบปล่อยเวลานัดหมายนี้แล้ว เพราะยังไม่ได้ชำระเงินภายในเวลาที่กำหนด",
          metadataJson: {
            consultationId: consultation.id,
            href: `/consult/appointments/${consultation.id}`,
            scheduledAt: consultation.scheduledAt?.toISOString() ?? null
          }
        }))
      });

    }

    await Promise.all(
      expiredConsultations.map((consultation) => {
        const requiresReschedule = manualReviewCandidates.some(
          (candidate) => candidate.id === consultation.id
        );
        return (
          writeAuditLog(tx, {
            actorId: null,
            action: "consultation.slot_lock_expired",
            entityType: "consultation",
            entityId: consultation.id,
            metadata: {
              doctorId: consultation.doctorId,
              slotLockId: consultation.slotLockId,
              scheduledAt: consultation.scheduledAt?.toISOString() ?? null,
              nextStatus: requiresReschedule ? "reschedule_required" : "cancelled",
              paymentReviewPreserved: requiresReschedule
            }
          })
        );
      })
    );

    const deletedLinkedLocks =
      lockIds.length > 0
        ? await tx.consultationSlotLock.deleteMany({
            where: {
              id: {
                in: lockIds
              }
            }
          })
        : { count: 0 };

    const deletedOrphanLocks = await tx.consultationSlotLock.deleteMany({
      where: {
        expiresAt: {
          lte: now
        },
        consultation: null
      }
    });

    return {
      expiredConsultations: expiredConsultations.length,
      deletedOrphanLocks: deletedLinkedLocks.count + deletedOrphanLocks.count
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
