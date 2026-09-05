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

function normalizeCalendarView(value: string | undefined): "day" | "week" | "month" {
  return value === "week" || value === "month" ? value : "day";
}

function addCalendarDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getCalendarDateValues(dateValue: string, view: "day" | "week" | "month"): string[] {
  if (view === "day") return [dateValue];
  if (view === "week") {
    const weekday = new Date(`${dateValue}T12:00:00+07:00`).getUTCDay();
    const start = addCalendarDays(dateValue, -((weekday + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
  }
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  const start = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: lastDay }, (_, index) => addCalendarDays(start, index));
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
    effectiveFromValue: slot.effectiveFrom?.toISOString().slice(0, 10) ?? null,
    effectiveToValue: slot.effectiveTo?.toISOString().slice(0, 10) ?? null,
    effectiveRangeLabel: slot.effectiveFrom || slot.effectiveTo
      ? `${slot.effectiveFrom ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(slot.effectiveFrom) : "ทันที"} – ${slot.effectiveTo ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(slot.effectiveTo) : "ไม่กำหนด"}`
      : "ใช้ต่อเนื่อง",
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

async function getAppointmentCalendar(input: { doctors: DoctorRecord[]; dateValue: string; doctorId?: string; view?: string; now: Date }): Promise<AdminAppointmentCalendarData> {
  const eligibleDoctors = input.doctors.filter((doctor) => doctor.user.status === "active");
  const selectedDoctorId = eligibleDoctors.some((doctor) => doctor.id === input.doctorId) ? input.doctorId! : "";
  const view = normalizeCalendarView(input.view);
  const dateValues = getCalendarDateValues(input.dateValue, view);
  const lastDateValue = dateValues[dateValues.length - 1];
  const dayStart = getScheduledAtForCalendarDate(dateValues[0], "00:00");
  const dayEnd = getScheduledAtForCalendarDate(addCalendarDays(lastDateValue, 1), "00:00");
  const overrideStart = new Date(`${dateValues[0]}T00:00:00.000Z`);
  const overrideEnd = new Date(`${addCalendarDays(lastDateValue, 1)}T00:00:00.000Z`);
  const [availabilities, overrides, consultations] =
    !selectedDoctorId
      ? [[], [], []]
      : await Promise.all([
          prisma.doctorAvailability.findMany({
            where: { doctorId: selectedDoctorId, isActive: true },
            select: { id: true, doctorId: true, weekday: true, startTime: true, endTime: true, slotMinutes: true, effectiveFrom: true, effectiveTo: true, notes: true }
          }),
          prisma.doctorAvailabilityDateOverride.findMany({
            where: { doctorId: selectedDoctorId, scheduleDate: { gte: overrideStart, lt: overrideEnd }, isActive: true },
            select: { id: true, doctorId: true, scheduleDate: true, type: true, startTime: true, endTime: true, slotMinutes: true, notes: true }
          }),
          prisma.consultation.findMany({
            where: { doctorId: selectedDoctorId, scheduledAt: { gte: dayStart, lt: dayEnd }, status: { in: ["pending_payment", "scheduled", "live"] } },
            select: {
              doctorId: true,
              scheduledAt: true,
              status: true,
              slotLock: { select: { expiresAt: true } }
            }
          })
        ]);
  const doctorName = selectedDoctorId ? getDoctorName(eligibleDoctors.find((doctor) => doctor.id === selectedDoctorId)!) : "แพทย์ผู้ให้คำปรึกษา";
  const calendarConsultations = consultations.flatMap((consultation) => consultation.status === "pending_payment" || consultation.status === "scheduled" || consultation.status === "live" ? [{ doctorId: consultation.doctorId, scheduledAt: consultation.scheduledAt, status: consultation.status, slotLockExpiresAt: consultation.slotLock?.expiresAt ?? null }] : []);

  return {
    dateValue: input.dateValue,
    dateLabel: new Intl.DateTimeFormat("th-TH", { timeZone: CLINIC_TIME_ZONE, dateStyle: "medium" }).format(dayStart),
    view,
    doctors: eligibleDoctors.map((doctor) => ({ id: doctor.id, name: getDoctorName(doctor) })),
    selectedDoctorId,
    days: dateValues.map((dateValue) => ({
      dateValue,
      dateLabel: new Intl.DateTimeFormat("th-TH", { timeZone: CLINIC_TIME_ZONE, dateStyle: "medium" }).format(getScheduledAtForCalendarDate(dateValue, "00:00")),
      slots: buildAdminAppointmentCalendarSlots({ availabilities, overrides: overrides.filter((override) => override.scheduleDate.toISOString().slice(0, 10) === dateValue), consultations: calendarConsultations.filter((consultation) => consultation.scheduledAt && getBangkokCalendarDateKey(consultation.scheduledAt) === dateValue), dateValue, now: input.now }).map((slot) => {
        const consultation = slot.consultation;
        const status = consultation?.status ?? "available";
        return { id: `${slot.doctorId}:${slot.scheduledAt.toISOString()}`, doctorId: slot.doctorId, doctorName, availabilityId: slot.availabilityId, scheduledAtIso: slot.scheduledAt.toISOString(), timeLabel: slot.timeLabel, status, statusLabel: status === "pending_payment" ? "รอชำระเงิน" : status === "scheduled" ? "จองแล้ว" : status === "live" ? "กำลังปรึกษา" : "ว่าง", lockExpiresAt: consultation?.status === "pending_payment" && consultation.slotLockExpiresAt ? formatDate(consultation.slotLockExpiresAt) : null };
      })
    }))
  };
}

export async function getAdminSchedules(input: { date?: string; doctorId?: string; view?: string } = {}): Promise<AdminSchedulesData> {
  noStore();

  try {
    const now = new Date();
    const dateValue = normalizeScheduleDate(input.date, now);
    const [doctors, slots, dateOverrides, manualAppointmentPatients] = await Promise.all([getApprovedDoctors(), getAvailabilitySlots(), getDateOverrides(), prisma.user.findMany({ where: { role: "customer", status: "active", fullName: { not: null }, dateOfBirth: { not: null }, phone: { not: null }, normalizedPhone: { not: null }, phoneVerifiedAt: { not: null } }, orderBy: { fullName: "asc" }, take: 100, select: { id: true, fullName: true } })]);
    const slotItems = slots.map(mapSlot);
    const appointmentCalendar = await getAppointmentCalendar({ doctors, dateValue, doctorId: input.doctorId, view: input.view, now });

    return {
      doctors: doctors.map(mapDoctor),
      slots: slotItems,
      dateOverrides: dateOverrides.map(mapDateOverride),
      appointmentCalendar,
      manualAppointmentPatients: manualAppointmentPatients.map((patient) => ({ id: patient.id, name: patient.fullName! })),
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
        view: normalizeCalendarView(input.view),
        doctors: [],
        selectedDoctorId: "",
        days: []
      },
      manualAppointmentPatients: [],
      summary: {
        activeDoctors: 0,
        activeSlots: 0,
        inactiveSlots: 0
      },
      unavailable: true
    };
  }
}
