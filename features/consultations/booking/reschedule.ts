import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  getActiveConsultationSlotWhere,
  getBangkokCalendarDateKey,
  getScheduledAtForDate,
  getScheduledSlotTimes,
  getUpcomingDateForWeekday
} from "@/features/consultations/booking/slots";

export class ConsultationRescheduleError extends Error {
  constructor(readonly code: "NOT_ELIGIBLE" | "SLOT_UNAVAILABLE" | "CONFLICT") {
    super(code);
    this.name = "ConsultationRescheduleError";
  }
}

export async function rescheduleVerifiedConsultation(
  tx: Prisma.TransactionClient,
  input: {
    availabilityId: string;
    consultationId: string;
    doctorId: string;
    patientId: string;
    scheduledAt: Date;
  },
  now = new Date()
): Promise<void> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${input.consultationId} FOR UPDATE`
  );
  const consultation = await tx.consultation.findUnique({
    where: { id: input.consultationId },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      scheduledAt: true,
      slotLockId: true,
      status: true,
      payment: { select: { status: true } },
      doctor: { select: { userId: true } }
    }
  });
  if (
    !consultation ||
    consultation.patientId !== input.patientId ||
    consultation.doctorId !== input.doctorId ||
    consultation.status !== "reschedule_required" ||
    consultation.slotLockId !== null ||
    consultation.payment?.status !== "verified"
  ) {
    throw new ConsultationRescheduleError("NOT_ELIGIBLE");
  }

  const availability = await tx.doctorAvailability.findUnique({
    where: { id: input.availabilityId },
    include: {
      doctor: {
        select: { id: true, status: true, user: { select: { status: true } } }
      }
    }
  });
  const dateOverride = availability
    ? null
    : await tx.doctorAvailabilityDateOverride.findUnique({
        where: { id: input.availabilityId },
        include: {
          doctor: {
            select: { id: true, status: true, user: { select: { status: true } } }
          }
        }
      });
  const source = availability ?? dateOverride;
  if (
    !source?.isActive ||
    source.doctorId !== consultation.doctorId ||
    source.doctor.status !== "approved" ||
    source.doctor.user.status !== "active"
  ) {
    throw new ConsultationRescheduleError("SLOT_UNAVAILABLE");
  }

  let sourceScheduledAt: Date;
  let startTime: string;
  let endTime: string;
  let slotMinutes: number;
  if (dateOverride) {
    if (
      dateOverride.type !== "available" ||
      !dateOverride.startTime ||
      !dateOverride.endTime ||
      !dateOverride.slotMinutes
    ) {
      throw new ConsultationRescheduleError("SLOT_UNAVAILABLE");
    }
    sourceScheduledAt = getScheduledAtForDate(
      dateOverride.scheduleDate,
      dateOverride.startTime
    );
    startTime = dateOverride.startTime;
    endTime = dateOverride.endTime;
    slotMinutes = dateOverride.slotMinutes;
  } else {
    sourceScheduledAt = getUpcomingDateForWeekday(
      availability!.weekday,
      availability!.startTime,
      now
    );
    startTime = availability!.startTime;
    endTime = availability!.endTime;
    slotMinutes = availability!.slotMinutes;
    const scheduledDate = getBangkokCalendarDateKey(input.scheduledAt);
    const effectiveFrom = availability!.effectiveFrom?.toISOString().slice(0, 10);
    const effectiveTo = availability!.effectiveTo?.toISOString().slice(0, 10);
    if (
      (effectiveFrom && scheduledDate < effectiveFrom) ||
      (effectiveTo && scheduledDate > effectiveTo)
    ) {
      throw new ConsultationRescheduleError("SLOT_UNAVAILABLE");
    }
  }

  const validSlots = getScheduledSlotTimes(
    sourceScheduledAt,
    startTime,
    endTime,
    slotMinutes
  );
  if (
    input.scheduledAt <= now ||
    !validSlots.some((slot) => slot.getTime() === input.scheduledAt.getTime())
  ) {
    throw new ConsultationRescheduleError("SLOT_UNAVAILABLE");
  }

  const existing = await tx.consultation.findFirst({
    where: {
      id: { not: consultation.id },
      doctorId: consultation.doctorId,
      scheduledAt: input.scheduledAt,
      ...getActiveConsultationSlotWhere(now)
    },
    select: { id: true }
  });
  if (existing) throw new ConsultationRescheduleError("SLOT_UNAVAILABLE");

  let slotLock: { id: string };
  try {
    slotLock = await tx.consultationSlotLock.create({
      data: {
        doctorId: consultation.doctorId,
        scheduledAt: input.scheduledAt,
        availabilityId: source.id,
        patientId: consultation.patientId,
        expiresAt: null
      },
      select: { id: true }
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      throw new ConsultationRescheduleError("SLOT_UNAVAILABLE");
    }
    throw error;
  }

  const updated = await tx.consultation.updateMany({
    where: {
      id: consultation.id,
      status: "reschedule_required",
      slotLockId: null
    },
    data: {
      bookedDurationMinutes: slotMinutes,
      scheduledAt: input.scheduledAt,
      slotLockId: slotLock.id,
      status: "scheduled"
    }
  });
  if (updated.count !== 1) throw new ConsultationRescheduleError("CONFLICT");

  await tx.notification.createMany({
    data: [
      {
        userId: consultation.patientId,
        type: "consultation",
        channel: "in_app",
        title: "เลือกเวลาปรึกษาใหม่แล้ว",
        body: "นัดหมายที่ชำระเงินแล้วได้รับการยืนยันในเวลาใหม่",
        metadataJson: {
          consultationId: consultation.id,
          href: `/consult/appointments/${consultation.id}`
        }
      },
      {
        userId: consultation.doctor.userId,
        type: "consultation",
        channel: "in_app",
        title: "มีนัดหมายปรึกษาใหม่",
        body: "ลูกค้าเลือกเวลาใหม่สำหรับรายการที่ชำระเงินแล้ว กรุณาตรวจคิวปรึกษา",
        metadataJson: {
          consultationId: consultation.id,
          href: "/doctor/consultations"
        }
      }
    ]
  });

  await writeAuditLog(tx, {
    actorId: input.patientId,
    action: "consultation.rescheduled_after_manual_payment",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      availabilityId: source.id,
      previousScheduledAt: consultation.scheduledAt?.toISOString() ?? null,
      scheduledAt: input.scheduledAt.toISOString(),
      slotLockId: slotLock.id,
      slotMinutes,
      previousStatus: "reschedule_required",
      nextStatus: "scheduled"
    }
  });
}
