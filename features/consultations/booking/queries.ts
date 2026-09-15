import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { CLINIC_TIME_ZONE, formatBangkokTime, getActiveConsultationSlotWhere, getBangkokCalendarDateKey, getScheduledAtForCalendarDate, getScheduledAtForDate, getScheduledSlotTimes, getUpcomingDateForWeekday } from "@/features/consultations/booking/slots";
import type { BookingSlot, DoctorBookingData } from "@/features/consultations/booking/types";
import { isSlotBlockedByDateOverride } from "@/features/consultations/booking/blocked-overrides";
import { getBookedConsultationDurationMinutes, getNewScheduleDurationMinutes } from "@/features/consultations/duration-policy";
import { doesConsultationTimeOverlap } from "@/features/consultations/booking/interval-lock";

type DoctorRecord = NonNullable<Awaited<ReturnType<typeof getBookingDoctor>>>;
type AvailabilityRecord = DoctorRecord["availability"][number];
type DateOverrideRecord = DoctorRecord["dateOverrides"][number];
type BookingSource = { id: string; scheduledAt: Date; startTime: string; endTime: string; slotMinutes: number; notes: string | null; weekdayLabel: string; effectiveFrom?: Date | null; effectiveTo?: Date | null };

const weekdayLabels = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const doctorIdSchema = z.string().cuid();

function getBookingDoctor(doctorId?: string) {
  return prisma.doctor.findFirst({
    where: {
      ...(doctorId ? { id: doctorId } : {}),
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
      },
      dateOverrides: {
        where: { isActive: true },
        orderBy: [{ scheduleDate: "asc" }, { startTime: "asc" }]
      }
    }
  });
}

function formatMoney(value: number | null): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value ?? 1000)} บาท`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: CLINIC_TIME_ZONE,
    day: "numeric",
    month: "short"
  }).format(date);
}

function isAvailabilityEffectiveOn(slot: Pick<BookingSource, "effectiveFrom" | "effectiveTo">, scheduledAt: Date): boolean {
  const calendarDate = getBangkokCalendarDateKey(scheduledAt);
  const effectiveFrom = slot.effectiveFrom?.toISOString().slice(0, 10);
  const effectiveTo = slot.effectiveTo?.toISOString().slice(0, 10);
  return (!effectiveFrom || calendarDate >= effectiveFrom) && (!effectiveTo || calendarDate <= effectiveTo);
}

function mapSlot(
  slot: BookingSource,
  occupiedIntervals: Array<{ scheduledAt: Date; durationMinutes: number }>
): BookingSlot {
  const isBooked = occupiedIntervals.some((occupied) =>
    doesConsultationTimeOverlap({
      candidateScheduledAt: slot.scheduledAt,
      candidateDurationMinutes: slot.slotMinutes,
      existingScheduledAt: occupied.scheduledAt,
      existingDurationMinutes: occupied.durationMinutes
    })
  );

  return {
    id: slot.id,
    slotKey: `${slot.id}:${slot.scheduledAt.toISOString()}`,
    weekdayLabel: slot.weekdayLabel,
    dateLabel: formatDate(slot.scheduledAt),
    timeLabel: `${slot.startTime}-${slot.endTime}`,
    slotMinutes: getNewScheduleDurationMinutes(slot.slotMinutes),
    scheduledAt: slot.scheduledAt.toISOString(),
    status: isBooked ? "booked" : "available",
    statusLabel: isBooked ? "จองแล้ว" : "ว่าง",
    notes: slot.notes ?? "รับปรึกษาออนไลน์"
  };
}

export function getBookingSources(availability: AvailabilityRecord[], dateOverrides: DateOverrideRecord[], now: Date): BookingSource[] {
  const closedDates = new Set(
    dateOverrides
      .filter((override) => override.type === "closed")
      .map((override) => override.scheduleDate.toISOString().slice(0, 10))
  );
  const recurring = availability
    .map((slot) => ({
      id: slot.id,
      scheduledAt: getUpcomingDateForWeekday(slot.weekday, slot.endTime, now),
      startTime: slot.startTime,
      endTime: slot.endTime,
      slotMinutes: getNewScheduleDurationMinutes(slot.slotMinutes),
      notes: slot.notes,
      effectiveFrom: slot.effectiveFrom,
      effectiveTo: slot.effectiveTo,
      weekdayLabel: weekdayLabels[slot.weekday] ?? String(slot.weekday)
    }))
    .filter((slot) => !closedDates.has(getBangkokCalendarDateKey(slot.scheduledAt)))
    .filter((slot) => isAvailabilityEffectiveOn(slot, slot.scheduledAt));
  const special = dateOverrides
    .filter((override) => override.type === "available" && override.startTime && override.endTime && override.slotMinutes)
    .filter((override) => !closedDates.has(override.scheduleDate.toISOString().slice(0, 10)))
    .map((override) => ({
      id: override.id,
      scheduledAt: getScheduledAtForDate(override.scheduleDate, override.startTime!),
      startTime: override.startTime!,
      endTime: override.endTime!,
      slotMinutes: getNewScheduleDurationMinutes(override.slotMinutes),
      notes: override.notes,
      weekdayLabel: weekdayLabels[override.scheduleDate.getUTCDay()] ?? "วันที่เลือก"
    }))
    .filter((slot) =>
      getScheduledAtForCalendarDate(getBangkokCalendarDateKey(slot.scheduledAt), slot.endTime) > now
    );

  const expanded = [...recurring, ...special].flatMap((source) =>
    getScheduledSlotTimes(source.scheduledAt, source.startTime, source.endTime, source.slotMinutes).map((scheduledAt) => ({
      ...source,
      scheduledAt,
      startTime: formatBangkokTime(scheduledAt),
      endTime: formatBangkokTime(new Date(scheduledAt.getTime() + source.slotMinutes * 60 * 1000))
    }))
  );
  const seen = new Set<number>();
  return expanded
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    .filter((slot) => slot.scheduledAt > now)
    .filter((slot) => !isSlotBlockedByDateOverride(dateOverrides, slot.scheduledAt, slot.slotMinutes))
    .filter((slot) => {
      const timestamp = slot.scheduledAt.getTime();
      if (seen.has(timestamp)) return false;
      seen.add(timestamp);
      return true;
    });
}

export async function getDoctorBookingData(doctorId?: string): Promise<DoctorBookingData> {
  noStore();

  try {
    const now = new Date();
    const selectedDoctorId = doctorId?.trim();

    // A requested doctor must be a valid ID and must pass the same approval and
    // active-account gate as the list. Do not silently substitute another doctor.
    if (selectedDoctorId && !doctorIdSchema.safeParse(selectedDoctorId).success) {
      return { doctor: null, slots: [] };
    }

    const doctor = await getBookingDoctor(selectedDoctorId);

    if (!doctor) {
      return {
        doctor: null,
        slots: []
      };
    }

    const bookingSources = getBookingSources(doctor.availability, doctor.dateOverrides, now);
    const candidateDates = bookingSources.map((slot) => slot.scheduledAt);
    const [slotLocks, activeConsultations] =
      candidateDates.length > 0
        ? await Promise.all([
            prisma.consultationSlotLock.findMany({
              where: {
                doctorId: doctor.id,
                scheduledAt: {
                  gte: new Date(Math.min(...candidateDates.map((date) => date.getTime())) - 60 * 60 * 1000),
                  lt: new Date(Math.max(...candidateDates.map((date) => date.getTime())) + 60 * 60 * 1000)
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
                scheduledAt: true,
                availabilityId: true,
                consultation: { select: { bookedDurationMinutes: true } }
              }
            }),
            prisma.consultation.findMany({
              where: {
                doctorId: doctor.id,
                scheduledAt: {
                  gte: new Date(Math.min(...candidateDates.map((date) => date.getTime())) - 60 * 60 * 1000),
                  lt: new Date(Math.max(...candidateDates.map((date) => date.getTime())) + 60 * 60 * 1000)
                },
                ...getActiveConsultationSlotWhere(now)
              },
              select: {
                scheduledAt: true,
                bookedDurationMinutes: true
              }
            })
          ])
        : [[], []];
    const durationBySource = new Map(
      [...doctor.availability, ...doctor.dateOverrides].map((source) => [
        source.id,
        getBookedConsultationDurationMinutes(source.slotMinutes)
      ])
    );
    const occupiedIntervals = [
      ...activeConsultations.flatMap((consultation) =>
        consultation.scheduledAt
          ? [{
              scheduledAt: consultation.scheduledAt,
              durationMinutes: getBookedConsultationDurationMinutes(
                consultation.bookedDurationMinutes
              )
            }]
          : []
      ),
      ...slotLocks.map((lock) => ({
        scheduledAt: lock.scheduledAt,
        durationMinutes: getBookedConsultationDurationMinutes(
          lock.consultation?.bookedDurationMinutes ??
            (lock.availabilityId
              ? durationBySource.get(lock.availabilityId)
              : null)
        )
      }))
    ];

    return {
      doctor: {
        id: doctor.id,
        name: doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
        specialty: doctor.specialty ?? "ปรึกษาออนไลน์",
        fee: formatMoney(doctor.consultationFee),
        avatarUrl: doctor.user.avatarUrl ?? "/images/doctors/kamonpat.jpg"
      },
      slots: bookingSources.map((slot) => mapSlot(slot, occupiedIntervals))
    };
  } catch {
    return {
      doctor: null,
      slots: [],
      unavailable: true
    };
  }
}

export async function getVerifiedRescheduleContext(
  patientId: string,
  consultationId?: string
): Promise<{ consultationId: string; doctorId: string } | null> {
  noStore();
  if (!consultationId || !doctorIdSchema.safeParse(consultationId).success) return null;
  try {
    return await prisma.consultation.findFirst({
      where: {
        id: consultationId,
        patientId,
        status: "reschedule_required",
        slotLockId: null,
        payment: { is: { status: "verified" } }
      },
      select: { id: true, doctorId: true }
    }).then((consultation) =>
      consultation
        ? { consultationId: consultation.id, doctorId: consultation.doctorId }
        : null
    );
  } catch {
    return null;
  }
}
