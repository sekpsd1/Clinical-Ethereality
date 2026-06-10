import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/audit-log";

export type SlotLockReleaseResult = {
  expiredConsultations: number;
  deletedOrphanLocks: number;
};

export async function releaseExpiredConsultationSlotLocks(now = new Date()): Promise<SlotLockReleaseResult> {
  return prisma.$transaction(async (tx) => {
    const expiredConsultations = await tx.consultation.findMany({
      where: {
        status: "pending_payment",
        slotLockId: {
          not: null
        },
        slotLock: {
          is: {
            expiresAt: {
              lte: now
            }
          }
        }
      },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
        scheduledAt: true,
        slotLockId: true
      }
    });

    const lockIds = expiredConsultations.flatMap((consultation) => (consultation.slotLockId ? [consultation.slotLockId] : []));

    if (expiredConsultations.length > 0) {
      await tx.consultation.updateMany({
        where: {
          id: {
            in: expiredConsultations.map((consultation) => consultation.id)
          },
          status: "pending_payment"
        },
        data: {
          status: "cancelled",
          slotLockId: null
        }
      });

      await tx.notification.createMany({
        data: expiredConsultations.map((consultation) => ({
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

      await Promise.all(
        expiredConsultations.map((consultation) =>
          writeAuditLog(tx, {
            actorId: null,
            action: "consultation.slot_lock_expired",
            entityType: "consultation",
            entityId: consultation.id,
            metadata: {
              doctorId: consultation.doctorId,
              slotLockId: consultation.slotLockId,
              scheduledAt: consultation.scheduledAt?.toISOString() ?? null,
              nextStatus: "cancelled"
            }
          })
        )
      );
    }

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
  });
}
