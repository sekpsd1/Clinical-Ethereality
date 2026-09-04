"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { createConsultationBookingSchema } from "@/features/consultations/booking/schema";
import { releaseExpiredConsultationSlotLocks } from "@/features/consultations/booking/lock-release";
import { getActiveConsultationSlotWhere, getBangkokCalendarDateKey, getScheduledAtForDate, getScheduledSlotTimes, getSlotLockExpiresAt, getUpcomingDateForWeekday } from "@/features/consultations/booking/slots";
import { PatientVerificationError, requireVerifiedPatientProfile } from "@/features/identity-verification/service";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createConsultationBookingAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "consultation:create:self");

  const parsed = createConsultationBookingSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    redirect("/consult/booking/somchai?booking=invalid");
  }

  try {
    await requireVerifiedPatientProfile(session.userId);
  } catch (error) {
    if (error instanceof PatientVerificationError) {
      redirect("/consult/booking/somchai?booking=identity_required");
    }
    throw error;
  }

  let consultationId: string | null = null;

  try {
    await releaseExpiredConsultationSlotLocks();

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const patient = await tx.user.findUnique({
        where: { id: session.userId },
        select: {
          fullName: true,
          dateOfBirth: true,
          phone: true,
          normalizedPhone: true,
          phoneVerifiedAt: true
        }
      });
      if (!patient?.fullName || !patient.dateOfBirth || !patient.phone || !patient.normalizedPhone || !patient.phoneVerifiedAt) {
        throw new PatientVerificationError("PROFILE_REQUIRED");
      }
      const availability = await tx.doctorAvailability.findUnique({
        where: {
          id: parsed.data.availabilityId
        },
        include: {
          doctor: {
            select: {
              id: true,
              status: true,
              consultationFee: true
            }
          }
        }
      });

      const dateOverride = availability
        ? null
        : await tx.doctorAvailabilityDateOverride.findUnique({
            where: { id: parsed.data.availabilityId },
            include: { doctor: { select: { id: true, status: true, consultationFee: true } } }
          });

      const scheduleSource = availability ?? dateOverride;

      if (!scheduleSource?.isActive || scheduleSource.doctor.status !== "approved") {
        throw new Error("Availability is not open for booking.");
      }

      const isDateOverride = dateOverride !== null;
      let sourceScheduledAt: Date;
      let slotMinutes: number;
      let startTime: string;
      let endTime: string;

      if (dateOverride) {
        if (dateOverride.type !== "available" || !dateOverride.startTime || !dateOverride.endTime || !dateOverride.slotMinutes) {
          throw new Error("Availability is not open for booking.");
        }

        sourceScheduledAt = getScheduledAtForDate(dateOverride.scheduleDate, dateOverride.startTime);
        slotMinutes = dateOverride.slotMinutes;
        startTime = dateOverride.startTime;
        endTime = dateOverride.endTime;
      } else {
        sourceScheduledAt = getUpcomingDateForWeekday(availability!.weekday, availability!.startTime);
        slotMinutes = availability!.slotMinutes;
        startTime = availability!.startTime;
        endTime = availability!.endTime;
      }

      const scheduledAt = new Date(parsed.data.scheduledAt);
      const scheduledDate = getBangkokCalendarDateKey(scheduledAt);
      const effectiveFrom = availability?.effectiveFrom?.toISOString().slice(0, 10);
      const effectiveTo = availability?.effectiveTo?.toISOString().slice(0, 10);

      if (availability && ((effectiveFrom && scheduledDate < effectiveFrom) || (effectiveTo && scheduledDate > effectiveTo))) {
        throw new Error("Availability is not open for booking.");
      }
      const validSlotTimes = getScheduledSlotTimes(
        sourceScheduledAt,
        startTime,
        endTime,
        slotMinutes
      );

      if (scheduledAt <= now || !validSlotTimes.some((slot) => slot.getTime() === scheduledAt.getTime())) {
        throw new Error("Availability is not open for booking.");
      }

      const doctorId = scheduleSource.doctorId;
      const existing = await tx.consultation.findFirst({
        where: {
          doctorId,
          scheduledAt,
          ...getActiveConsultationSlotWhere(now)
        },
        select: {
          id: true
        }
      });

      if (existing) {
        throw new Error("This slot is already reserved.");
      }

      const slotLock = await tx.consultationSlotLock.create({
        data: {
          doctorId,
          scheduledAt,
          availabilityId: scheduleSource.id,
          patientId: session.userId,
          expiresAt: getSlotLockExpiresAt(now)
        },
        select: {
          id: true
        }
      });

      const activeAssessment = session.userId.startsWith("dev:")
        ? null
        : await tx.consultAssessment.findFirst({
            where: {
              userId: session.userId,
              expiresAt: {
                gt: new Date()
              }
            },
            orderBy: {
              completedAt: "desc"
            },
            select: {
              id: true,
              symptomLabel: true,
              durationLabel: true,
              recommendationTopic: true,
              recommendationSpecialty: true
            }
          });

      const consultation = await tx.consultation.create({
        data: {
          patientId: session.userId,
          doctorId,
          assessmentId: activeAssessment?.id,
          slotLockId: slotLock.id,
          bookedDurationMinutes: slotMinutes,
          status: "pending_payment",
          scheduledAt,
          summary: activeAssessment
            ? `แบบประเมิน: ${activeAssessment.symptomLabel}, ${activeAssessment.durationLabel}. คำแนะนำ: ${activeAssessment.recommendationSpecialty}.`
            : `Booking requested from availability ${scheduleSource.id}`
        },
        select: {
          id: true
        }
      });

      await tx.notification.create({
        data: {
          userId: session.userId,
          type: "consultation",
          channel: "in_app",
          title: "สร้างคำขอนัดหมายแล้ว",
          body: "กรุณาชำระค่าปรึกษาเพื่อยืนยันเวลานัดหมาย",
          metadataJson: {
            consultationId: consultation.id,
            href: `/consult/appointments/${consultation.id}`
          }
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "consultation.book_slot",
        entityType: "consultation",
        entityId: consultation.id,
        metadata: {
          doctorId,
          availabilityId: scheduleSource.id,
          scheduleSource: isDateOverride ? "date_override" : "weekly",
          slotMinutes,
          slotLockId: slotLock.id,
          assessmentId: activeAssessment?.id ?? null,
          recommendationTopic: activeAssessment?.recommendationTopic ?? null,
          scheduledAt: scheduledAt.toISOString(),
          status: "pending_payment"
        }
      });

      return consultation;
    });

    consultationId = result.id;
  } catch (error) {
    if (error instanceof PatientVerificationError) {
      redirect("/consult/booking/somchai?booking=identity_required");
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      await releaseExpiredConsultationSlotLocks();
      redirect("/consult/booking/somchai?booking=locked");
    }

    redirect("/consult/booking/somchai?booking=failed");
  }

  revalidatePath("/consult/booking/somchai");
  revalidatePath(`/consult/appointments/${consultationId}`);
  revalidatePath("/consult/payment");
  revalidatePath("/notifications");
  revalidatePath("/admin");
  revalidatePath("/admin/audit");

  redirect(`/consult/appointments/${consultationId}`);
}
