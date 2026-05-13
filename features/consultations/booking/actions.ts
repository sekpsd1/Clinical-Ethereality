"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { createConsultationBookingSchema } from "@/features/consultations/booking/schema";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function getUpcomingDateForWeekday(weekday: number, startTime: string): Date {
  const now = new Date();
  const [hour, minute] = startTime.split(":").map(Number);
  const scheduledAt = new Date(now);
  const daysAhead = (weekday - now.getDay() + 7) % 7 || 7;

  scheduledAt.setDate(now.getDate() + daysAhead);
  scheduledAt.setHours(hour ?? 9, minute ?? 0, 0, 0);

  return scheduledAt;
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
    const result = await prisma.$transaction(async (tx) => {
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
          status: {
            in: ["pending_payment", "scheduled", "live"]
          }
        },
        select: {
          id: true
        }
      });

      if (existing) {
        throw new Error("This slot is already reserved.");
      }

      const consultation = await tx.consultation.create({
        data: {
          patientId: session.userId,
          doctorId: availability.doctorId,
          status: "pending_payment",
          scheduledAt,
          summary: `Booking requested from availability ${availability.id}`
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
          scheduledAt: scheduledAt.toISOString(),
          status: "pending_payment"
        }
      });

      return consultation;
    });

    consultationId = result.id;
  } catch {
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
