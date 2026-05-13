import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminDoctorAvailabilitySlot, AdminDoctorOption, AdminSchedulesData } from "@/features/admin/schedules/types";

type DoctorRecord = Awaited<ReturnType<typeof getApprovedDoctors>>[number];
type AvailabilityRecord = Awaited<ReturnType<typeof getAvailabilitySlots>>[number];

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
          lineUserId: true
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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getDoctorName(doctor: Pick<DoctorRecord, "user">): string {
  return doctor.user.displayName ?? doctor.user.lineUserId;
}

function mapDoctor(doctor: DoctorRecord): AdminDoctorOption {
  return {
    id: doctor.id,
    name: getDoctorName(doctor),
    specialty: doctor.specialty ?? "ยังไม่ระบุสาขา",
    status: doctor.status
  };
}

function mapSlot(slot: AvailabilityRecord): AdminDoctorAvailabilitySlot {
  return {
    id: slot.id,
    doctorName: getDoctorName(slot.doctor),
    doctorSpecialty: slot.doctor.specialty ?? "ยังไม่ระบุสาขา",
    weekday: slot.weekday,
    weekdayLabel: weekdayLabels[slot.weekday] ?? String(slot.weekday),
    timeRange: `${slot.startTime}-${slot.endTime}`,
    slotMinutes: slot.slotMinutes,
    isActive: slot.isActive,
    notes: slot.notes ?? "-",
    updatedAt: formatDate(slot.updatedAt)
  };
}

export async function getAdminSchedules(): Promise<AdminSchedulesData> {
  noStore();

  try {
    const [doctors, slots] = await Promise.all([getApprovedDoctors(), getAvailabilitySlots()]);
    const slotItems = slots.map(mapSlot);

    return {
      doctors: doctors.map(mapDoctor),
      slots: slotItems,
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
      summary: {
        activeDoctors: 0,
        activeSlots: 0,
        inactiveSlots: 0
      },
      unavailable: true
    };
  }
}
