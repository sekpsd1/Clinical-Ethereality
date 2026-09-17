import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions";
import { CLINIC_TIME_ZONE, getBangkokCalendarDateKey } from "@/features/consultations/booking/slots";
import type { CustomerUpcomingAppointment, CustomerUpcomingAppointmentData } from "@/features/profile/types";

function getRelativeDayLabel(scheduledAt: Date, now: Date): string {
  const today = getBangkokCalendarDateKey(now);
  const appointmentDay = getBangkokCalendarDateKey(scheduledAt);
  const dayDifference = Math.round(
    (Date.parse(`${appointmentDay}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000
  );

  if (dayDifference === 0) return "วันนี้";
  if (dayDifference === 1) return "พรุ่งนี้";
  return `อีก ${Math.max(dayDifference, 0)} วัน`;
}

function formatAppointmentDateTime(scheduledAt: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23"
  }).format(scheduledAt);
}

function mapAppointment(
  consultation: { id: string; scheduledAt: Date; doctor: { user: { displayName: string | null } } },
  additionalCount: number,
  now: Date
): CustomerUpcomingAppointment {
  return {
    id: consultation.id,
    doctorName: consultation.doctor.user.displayName ?? "แพทย์ผู้ดูแล",
    scheduledDateTime: formatAppointmentDateTime(consultation.scheduledAt),
    relativeDayLabel: getRelativeDayLabel(consultation.scheduledAt, now),
    isImminent: consultation.scheduledAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000,
    additionalCount
  };
}

export async function getCustomerUpcomingAppointment(
  session: PublicSession,
  now = new Date()
): Promise<CustomerUpcomingAppointmentData> {
  noStore();
  assertRole(session, ["customer"]);

  const where = {
    patientId: session.userId,
    status: "scheduled" as const,
    scheduledAt: { gte: now }
  };

  try {
    const [consultation, total] = await Promise.all([
      prisma.consultation.findFirst({
        where,
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          scheduledAt: true,
          doctor: {
            select: {
              user: { select: { displayName: true } }
            }
          }
        }
      }),
      prisma.consultation.count({ where })
    ]);

    if (!consultation?.scheduledAt) {
      return { appointment: null };
    }

    return {
      appointment: mapAppointment(
        { ...consultation, scheduledAt: consultation.scheduledAt },
        Math.max(0, total - 1),
        now
      )
    };
  } catch {
    return { appointment: null, unavailable: true };
  }
}
