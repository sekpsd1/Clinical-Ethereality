import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { BookingSlot, DoctorBookingData } from "@/features/consultations/booking/types";

type DoctorRecord = NonNullable<Awaited<ReturnType<typeof getPrimaryBookingDoctor>>>;
type AvailabilityRecord = DoctorRecord["availability"][number];

const weekdayLabels = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function getPrimaryBookingDoctor() {
  return prisma.doctor.findFirst({
    where: {
      user: {
        lineUserId: "seed-line-doctor-approved"
      },
      status: "approved"
    },
    include: {
      user: {
        select: {
          displayName: true
        }
      },
      availability: {
        where: {
          isActive: true
        },
        orderBy: [
          {
            weekday: "asc"
          },
          {
            startTime: "asc"
          }
        ]
      }
    }
  });
}

function formatMoney(value: number | null): string {
  return new Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value ?? 1000);
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function mapSlot(slot: AvailabilityRecord): BookingSlot {
  const scheduledAt = getUpcomingDateForWeekday(slot.weekday, slot.startTime);

  return {
    id: slot.id,
    weekdayLabel: weekdayLabels[slot.weekday] ?? String(slot.weekday),
    dateLabel: formatDate(scheduledAt),
    timeLabel: `${slot.startTime}-${slot.endTime}`,
    slotMinutes: slot.slotMinutes,
    scheduledAt: scheduledAt.toISOString(),
    notes: slot.notes ?? "รับปรึกษาออนไลน์"
  };
}

export async function getDoctorBookingData(): Promise<DoctorBookingData> {
  noStore();

  try {
    const doctor = await getPrimaryBookingDoctor();

    if (!doctor) {
      return {
        doctor: null,
        slots: []
      };
    }

    return {
      doctor: {
        id: doctor.id,
        name: doctor.user.displayName ?? "นพ. สมชาย",
        specialty: doctor.specialty ?? "เวชศาสตร์ชะลอวัย",
        fee: formatMoney(doctor.consultationFee)
      },
      slots: doctor.availability.map(mapSlot)
    };
  } catch {
    return {
      doctor: null,
      slots: [],
      unavailable: true
    };
  }
}
