import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { releaseExpiredConsultationSlotLocks } from "@/features/consultations/booking/lock-release";
import { getActiveConsultationSlotWhere, getSlotTimestamp, getUpcomingDateForWeekday } from "@/features/consultations/booking/slots";
import type { BookingSlot, DoctorBookingData } from "@/features/consultations/booking/types";

type DoctorRecord = NonNullable<Awaited<ReturnType<typeof getPrimaryBookingDoctor>>>;
type AvailabilityRecord = DoctorRecord["availability"][number];

const weekdayLabels = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function getPrimaryBookingDoctor() {
  return prisma.doctor.findFirst({
    where: {
      status: "approved",
      user: {
        status: "active"
      }
    },
    orderBy: [
      {
        approvedAt: "desc"
      },
      {
        createdAt: "asc"
      }
    ],
    include: {
      user: {
        select: {
          avatarUrl: true,
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function mapSlot(slot: AvailabilityRecord, lockedSlotTimes: Set<number>): BookingSlot {
  const scheduledAt = getUpcomingDateForWeekday(slot.weekday, slot.startTime);
  const isBooked = lockedSlotTimes.has(getSlotTimestamp(scheduledAt));

  return {
    id: slot.id,
    weekdayLabel: weekdayLabels[slot.weekday] ?? String(slot.weekday),
    dateLabel: formatDate(scheduledAt),
    timeLabel: `${slot.startTime}-${slot.endTime}`,
    slotMinutes: slot.slotMinutes,
    scheduledAt: scheduledAt.toISOString(),
    status: isBooked ? "booked" : "available",
    statusLabel: isBooked ? "จองแล้ว" : "ว่าง",
    notes: slot.notes ?? "รับปรึกษาออนไลน์"
  };
}

export async function getDoctorBookingData(): Promise<DoctorBookingData> {
  noStore();

  try {
    const now = new Date();
    await releaseExpiredConsultationSlotLocks(now);

    const doctor = await getPrimaryBookingDoctor();

    if (!doctor) {
      return {
        doctor: null,
        slots: []
      };
    }

    const candidateDates = doctor.availability.map((slot) => getUpcomingDateForWeekday(slot.weekday, slot.startTime));
    const [slotLocks, activeConsultations] =
      candidateDates.length > 0
        ? await Promise.all([
            prisma.consultationSlotLock.findMany({
              where: {
                doctorId: doctor.id,
                scheduledAt: {
                  in: candidateDates
                },
                OR: [
                  {
                    expiresAt: null
                  },
                  {
                    expiresAt: {
                      gt: now
                    }
                  }
                ]
              },
              select: {
                scheduledAt: true
              }
            }),
            prisma.consultation.findMany({
              where: {
                doctorId: doctor.id,
                scheduledAt: {
                  in: candidateDates
                },
                ...getActiveConsultationSlotWhere(now)
              },
              select: {
                scheduledAt: true
              }
            })
          ])
        : [[], []];
    const lockedSlotTimes = new Set(
      [...slotLocks, ...activeConsultations]
        .map((slot) => slot.scheduledAt)
        .filter((scheduledAt): scheduledAt is Date => Boolean(scheduledAt))
        .map(getSlotTimestamp)
    );

    return {
      doctor: {
        id: doctor.id,
        name: doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
        specialty: doctor.specialty ?? "ปรึกษาออนไลน์",
        fee: formatMoney(doctor.consultationFee),
        avatarUrl: doctor.user.avatarUrl?.startsWith("/") ? doctor.user.avatarUrl : "/images/doctors/kamonpat.jpg"
      },
      slots: doctor.availability.map((slot) => mapSlot(slot, lockedSlotTimes))
    };
  } catch {
    return {
      doctor: null,
      slots: [],
      unavailable: true
    };
  }
}
