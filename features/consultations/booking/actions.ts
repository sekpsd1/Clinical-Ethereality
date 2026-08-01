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
import { getActiveConsultationSlotWhere, getSlotLockExpiresAt, getUpcomingDateForWeekday } from "@/features/consultations/booking/slots";

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

  let consultationId: string | null = null;

  try {
    await releaseExpiredConsultationSlotLocks();

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
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

      if (!availability?.isActive || availability.doctor.status !== "approved") {
        throw new Error("Availability is not open for booking.");
      }

      const scheduledAt = getUpcomingDateForWeekday(availability.weekday, availability.startTime);
      const existing = await tx.consultation.findFirst({
        where: {
          doctorId: availability.doctorId,
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
          doctorId: availability.doctorId,
          scheduledAt,
          availabilityId: availability.id,
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
          doctorId: availability.doctorId,
          assessmentId: activeAssessment?.id,
          slotLockId: slotLock.id,
          status: "pending_payment",
          scheduledAt,
          summary: activeAssessment
            ? `แบบประเมิน: ${activeAssessment.symptomLabel}, ${activeAssessment.durationLabel}. คำแนะนำ: ${activeAssessment.recommendationSpecialty}.`
            : `Booking requested from availability ${availability.id}`
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
          doctorId: availability.doctorId,
          availabilityId: availability.id,
          slotMinutes: availability.slotMinutes,
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
