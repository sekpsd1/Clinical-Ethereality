import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { CLINIC_TIME_ZONE, getBangkokCalendarDateKey, getScheduledAtForCalendarDate } from "@/features/consultations/booking/slots";
import { buildAdminAppointmentCalendarSlots } from "@/features/admin/schedules/appointment-calendar";
import type { AdminAppointmentCalendarData, AdminDoctorAvailabilityDateOverride, AdminDoctorAvailabilitySlot, AdminDoctorOption, AdminSchedulesData } from "@/features/admin/schedules/types";

type DoctorRecord = Awaited<ReturnType<typeof getApprovedDoctors>>[number];
type AvailabilityRecord = Awaited<ReturnType<typeof getAvailabilitySlots>>[number];
type DateOverrideRecord = Awaited<ReturnType<typeof getDateOverrides>>[number];

const weekdayLabels = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function getApprovedDoctors() {
  return prisma.doctor.findMany({
    where: {
      status: "approved"
    },
    orderBy: {
      updatedAt: "desc"
    },
    include: {
      user: {
        select: {
          displayName: true,
          lineUserId: true,
          status: true
        }
      }
    }
  });
}

function getAvailabilitySlots() {
  return prisma.doctorAvailability.findMany({
    orderBy: [
      {
        weekday: "asc"
      },
      {
        startTime: "asc"
      }
    ],
    include: {
      doctor: {
        include: {
          user: {
            select: {
              displayName: true,
              lineUserId: true
            }
          }
        }
      }
    }
  });
}

function getDateOverrides() {
  return prisma.doctorAvailabilityDateOverride.findMany({
    orderBy: [{ scheduleDate: "asc" }, { startTime: "asc" }],
    include: {
      doctor: {
        include: {
          user: {
            select: {
              displayName: true,
              lineUserId: true
            }
          }
        }
      }
    }
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getTodayDateValue(now = new Date()): string {
  return getBangkokCalendarDateKey(now);
}

function normalizeScheduleDate(value: string | undefined, now: Date): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : getTodayDateValue(now);
}

function getDoctorName(doctor: { user: { displayName: string | null; lineUserId: string } }): string {
  return doctor.user.displayName ?? doctor.user.lineUserId;
}

function mapDoctor(doctor: DoctorRecord): AdminDoctorOption {
  const consultationFeeInput = doctor.consultationFee === null ? "" : `${doctor.consultationFee}.00`;
  const consultationFeeLabel =
    doctor.consultationFee === null
      ? "ยังไม่ตั้งค่า"
      : `${new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(doctor.consultationFee)} บาท`;

  return {
    id: doctor.id,
    name: getDoctorName(doctor),
    specialty: doctor.specialty ?? "ยังไม่ระบุสาขา",
    status: doctor.status,
    userStatus: doctor.user.status,
    consultationFeeInput,
    consultationFeeLabel,
    feeEligible: doctor.status === "approved" && doctor.user.status === "active",
    updatedAtIso: doctor.updatedAt.toISOString()
  };
}

function mapSlot(slot: AvailabilityRecord): AdminDoctorAvailabilitySlot {
  return {
    id: slot.id,
    doctorId: slot.doctorId,
    doctorName: getDoctorName(slot.doctor),
    doctorSpecialty: slot.doctor.specialty ?? "ยังไม่ระบุสาขา",
    weekday: slot.weekday,
    weekdayLabel: weekdayLabels[slot.weekday] ?? String(slot.weekday),
    startTime: slot.startTime,
    endTime: slot.endTime,
    timeRange: `${slot.startTime}-${slot.endTime}`,
    slotMinutes: slot.slotMinutes,
    isActive: slot.isActive,
    notes: slot.notes ?? "-",
    updatedAt: formatDate(slot.updatedAt)
  };
}

function mapDateOverride(override: DateOverrideRecord): AdminDoctorAvailabilityDateOverride {
  const scheduleDateValue = override.scheduleDate.toISOString().slice(0, 10);

  return {
    id: override.id,
    doctorId: override.doctorId,
    doctorName: getDoctorName(override.doctor),
    scheduleDate: new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(override.scheduleDate),
    scheduleDateValue,
    type: override.type,
    timeRange: override.type === "closed" ? "ปิดทั้งวัน" : `${override.startTime}-${override.endTime}`,
    slotMinutes: override.slotMinutes,
    isActive: override.isActive,
    notes: override.notes ?? "-",
    updatedAt: formatDate(override.updatedAt)
  };
}

async function getAppointmentCalendar(input: { doctors: DoctorRecord[]; dateValue: string; doctorId?: string; now: Date }): Promise<AdminAppointmentCalendarData> {
  const eligibleDoctors = input.doctors.filter((doctor) => doctor.user.status === "active");
  const selectedDoctorId = eligibleDoctors.some((doctor) => doctor.id === input.doctorId) ? input.doctorId! : "";
  const doctorIds = selectedDoctorId ? [selectedDoctorId] : eligibleDoctors.map((doctor) => doctor.id);
  const dayStart = getScheduledAtForCalendarDate(input.dateValue, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const overrideScheduleDate = new Date(`${input.dateValue}T00:00:00.000Z`);
  const [availabilities, overrides, consultations] =
    doctorIds.length === 0
      ? [[], [], []]
      : await Promise.all([
          prisma.doctorAvailability.findMany({
            where: { doctorId: { in: doctorIds }, isActive: true },
            select: { id: true, doctorId: true, weekday: true, startTime: true, endTime: true, slotMinutes: true, notes: true }
          }),
          prisma.doctorAvailabilityDateOverride.findMany({
            where: { doctorId: { in: doctorIds }, scheduleDate: overrideScheduleDate, isActive: true },
            select: { id: true, doctorId: true, type: true, startTime: true, endTime: true, slotMinutes: true, notes: true }
          }),
          prisma.consultation.findMany({
            where: { doctorId: { in: doctorIds }, scheduledAt: { gte: dayStart, lt: dayEnd }, status: { in: ["pending_payment", "scheduled", "live"] } },
            select: {
              doctorId: true,
              scheduledAt: true,
              status: true,
              patient: { select: { displayName: true } },
              slotLock: { select: { expiresAt: true } }
            }
          })
        ]);
  const namesByDoctorId = new Map(eligibleDoctors.map((doctor) => [doctor.id, getDoctorName(doctor)]));
  const slots = buildAdminAppointmentCalendarSlots({
    availabilities,
    overrides,
    consultations: consultations.flatMap((consultation) => {
      if (consultation.status !== "pending_payment" && consultation.status !== "scheduled" && consultation.status !== "live") {
        return [];
      }

      return [{
        doctorId: consultation.doctorId,
        scheduledAt: consultation.scheduledAt,
        status: consultation.status,
        patientName: consultation.patient.displayName ?? "ลูกค้า LINE ยังไม่ระบุชื่อ",
        slotLockExpiresAt: consultation.slotLock?.expiresAt ?? null
      }];
    }),
    dateValue: input.dateValue,
    now: input.now
  });

  return {
    dateValue: input.dateValue,
    dateLabel: new Intl.DateTimeFormat("th-TH", { timeZone: CLINIC_TIME_ZONE, dateStyle: "medium" }).format(dayStart),
    doctors: eligibleDoctors.map((doctor) => ({ id: doctor.id, name: getDoctorName(doctor) })),
    selectedDoctorId,
    slots: slots.map((slot) => {
      const consultation = slot.consultation;
      const status = consultation?.status ?? "available";
      return {
        id: `${slot.doctorId}:${slot.scheduledAt.toISOString()}`,
        doctorId: slot.doctorId,
        doctorName: namesByDoctorId.get(slot.doctorId) ?? "แพทย์ผู้ให้คำปรึกษา",
        timeLabel: slot.timeLabel,
        status,
        statusLabel:
          status === "pending_payment" ? "รอชำระเงิน" : status === "scheduled" ? "จองแล้ว" : status === "live" ? "กำลังปรึกษา" : "ว่าง",
        patientName: consultation?.patientName ?? null,
        lockExpiresAt: consultation?.status === "pending_payment" && consultation.slotLockExpiresAt ? formatDate(consultation.slotLockExpiresAt) : null
      };
    })
  };
}

export async function getAdminSchedules(input: { date?: string; doctorId?: string } = {}): Promise<AdminSchedulesData> {
  noStore();

  try {
    const now = new Date();
    const dateValue = normalizeScheduleDate(input.date, now);
    const [doctors, slots, dateOverrides] = await Promise.all([getApprovedDoctors(), getAvailabilitySlots(), getDateOverrides()]);
    const slotItems = slots.map(mapSlot);
    const appointmentCalendar = await getAppointmentCalendar({ doctors, dateValue, doctorId: input.doctorId, now });

    return {
      doctors: doctors.map(mapDoctor),
      slots: slotItems,
      dateOverrides: dateOverrides.map(mapDateOverride),
      appointmentCalendar,
      summary: {
        activeDoctors: doctors.length,
        activeSlots: slotItems.filter((slot) => slot.isActive).length,
        inactiveSlots: slotItems.filter((slot) => !slot.isActive).length
      }
    };
  } catch {
    return {
      doctors: [],
      slots: [],
      dateOverrides: [],
      appointmentCalendar: {
        dateLabel: "-",
        dateValue: normalizeScheduleDate(input.date, new Date()),
        doctors: [],
        selectedDoctorId: "",
        slots: []
      },
      summary: {
        activeDoctors: 0,
        activeSlots: 0,
        inactiveSlots: 0
      },
      unavailable: true
    };
  }
}
