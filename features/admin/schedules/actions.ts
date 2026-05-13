"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { toggleDoctorAvailabilitySchema, upsertDoctorAvailabilitySchema } from "@/features/admin/schedules/schema";

export type AdminScheduleActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function upsertDoctorAvailabilityAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = upsertDoctorAvailabilitySchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "ข้อมูลตารางแพทย์ไม่ถูกต้อง กรุณาตรวจสอบวันและเวลา"
    };
  }

  const { availabilityId, ...data } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const doctor = await tx.doctor.findUnique({
        where: {
          id: data.doctorId
        },
        select: {
          id: true,
          status: true
        }
      });

      if (!doctor || doctor.status !== "approved") {
        throw new Error("Doctor is not approved.");
      }

      const slot = availabilityId
        ? await tx.doctorAvailability.update({
            where: {
              id: availabilityId
            },
            data: {
              ...data,
              notes: data.notes || null
            }
          })
        : await tx.doctorAvailability.create({
            data: {
              ...data,
              notes: data.notes || null
            }
          });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: availabilityId ? "doctor_availability.update" : "doctor_availability.create",
        entityType: "doctor_availability",
        entityId: slot.id,
        metadata: {
          doctorId: data.doctorId,
          weekday: data.weekday,
          startTime: data.startTime,
          endTime: data.endTime,
          slotMinutes: data.slotMinutes,
          isActive: data.isActive
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกตารางแพทย์ได้ กรุณาลองใหม่"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");

  return {
    status: "success",
    message: "บันทึกตารางแพทย์เรียบร้อยแล้ว"
  };
}

export async function toggleDoctorAvailabilityAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = toggleDoctorAvailabilitySchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอปรับสถานะตารางไม่ถูกต้อง"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const slot = await tx.doctorAvailability.update({
        where: {
          id: parsed.data.availabilityId
        },
        data: {
          isActive: parsed.data.isActive
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "doctor_availability.toggle",
        entityType: "doctor_availability",
        entityId: slot.id,
        metadata: {
          doctorId: slot.doctorId,
          isActive: slot.isActive
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถปรับสถานะตารางได้"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");

  return {
    status: "success",
    message: "ปรับสถานะตารางเรียบร้อยแล้ว"
  };
}
