import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminDoctorAvailabilityDateOverride, AdminDoctorAvailabilitySlot, AdminDoctorOption, AdminSchedulesData } from "@/features/admin/schedules/types";

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
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
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

export async function getAdminSchedules(): Promise<AdminSchedulesData> {
  noStore();

  try {
    const [doctors, slots, dateOverrides] = await Promise.all([getApprovedDoctors(), getAvailabilitySlots(), getDateOverrides()]);
    const slotItems = slots.map(mapSlot);

    return {
      doctors: doctors.map(mapDoctor),
      slots: slotItems,
      dateOverrides: dateOverrides.map(mapDateOverride),
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
      summary: {
        activeDoctors: 0,
        activeSlots: 0,
        inactiveSlots: 0
      },
      unavailable: true
    };
  }
}
