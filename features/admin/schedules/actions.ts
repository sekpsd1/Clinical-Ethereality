"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { buildBatchAvailabilityRecords, findExistingAvailabilityConflict } from "@/features/admin/schedules/bulk";
import { getBangkokDayRange, hasOverlappingTimeBlock, parseScheduleDate } from "@/features/admin/schedules/date-overrides";
import {
  createDoctorAvailabilityDateOverrideSchema,
  deleteDoctorAvailabilityDateOverrideSchema,
  createDoctorAvailabilityBatchSchema,
  toggleDoctorAvailabilityDateOverrideSchema,
  toggleDoctorAvailabilitySchema,
  upsertDoctorAvailabilitySchema
} from "@/features/admin/schedules/schema";

export type AdminScheduleActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function getDoctorScheduleDateCheck(input: { doctorId: string; scheduleDate: string }): Promise<{ hasBooking: boolean }> {
  await requireAdminSession();
  if (!input.doctorId || !/^\d{4}-\d{2}-\d{2}$/.test(input.scheduleDate)) return { hasBooking: false };

  const { start, end } = getBangkokDayRange(parseScheduleDate(input.scheduleDate));
  const booking = await prisma.consultation.findFirst({
    where: { doctorId: input.doctorId, scheduledAt: { gte: start, lt: end }, status: { notIn: ["requested", "cancelled"] } },
    select: { id: true }
  });
  return { hasBooking: Boolean(booking) };
}

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function formDataToBatchObject(formData: FormData) {
  const blocksJson = formData.get("blocksJson");
  let blocks: unknown = [];

  if (typeof blocksJson === "string") {
    try {
      blocks = JSON.parse(blocksJson);
    } catch {
      blocks = [];
    }
  }

  return {
    doctorId: formData.get("doctorId"),
    weekdays: formData.getAll("weekdays"),
    blocks,
    isActive: formData.get("isActive"),
    notes: formData.get("notes"),
    effectiveFrom: formData.get("effectiveFrom"),
    effectiveTo: formData.get("effectiveTo")
  };
}

class BatchAvailabilityConflictError extends Error {}
class DateOverrideConflictError extends Error {}

async function findActiveBookingOnScheduleDate(tx: Prisma.TransactionClient, doctorId: string, scheduleDate: Date) {
  const { start, end } = getBangkokDayRange(scheduleDate);
  return tx.consultation.findFirst({
    where: {
      doctorId,
      scheduledAt: { gte: start, lt: end },
      status: { notIn: ["requested", "cancelled"] }
    },
    select: { id: true }
  });
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

  const { availabilityId, effectiveFrom, effectiveTo, ...data } = parsed.data;
  const effectiveDates = {
    effectiveFrom: effectiveFrom ? parseScheduleDate(effectiveFrom) : null,
    effectiveTo: effectiveTo ? parseScheduleDate(effectiveTo) : null
  };

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
              ...effectiveDates,
              notes: data.notes || null
            }
          })
        : await tx.doctorAvailability.create({
            data: {
              ...data,
              ...effectiveDates,
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
          effectiveFrom: effectiveFrom || null,
          effectiveTo: effectiveTo || null,
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

export async function createDoctorAvailabilityBatchAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = createDoctorAvailabilityBatchSchema.safeParse(formDataToBatchObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "ข้อมูลตารางแบบหลายช่วงไม่ถูกต้อง กรุณาตรวจสอบวัน เวลา และระยะเวลาต่อรอบ"
    };
  }

  const requestedSlots = buildBatchAvailabilityRecords(parsed.data);

  try {
    await prisma.$transaction(
      async (tx) => {
        const doctor = await tx.doctor.findUnique({
          where: {
            id: parsed.data.doctorId
          },
          select: {
            id: true,
            status: true
          }
        });

        if (!doctor || doctor.status !== "approved") {
          throw new Error("Doctor is not approved.");
        }

        const existingSlots = await tx.doctorAvailability.findMany({
          where: {
            doctorId: parsed.data.doctorId,
            weekday: {
              in: parsed.data.weekdays
            }
          },
          select: {
            weekday: true,
            startTime: true,
            endTime: true,
            slotMinutes: true
          }
        });

        const conflict = findExistingAvailabilityConflict(existingSlots, requestedSlots);

        if (conflict === "duplicate") {
          throw new BatchAvailabilityConflictError("มีรายการเวลาว่างเดิมซ้ำอยู่แล้ว");
        }

        if (conflict === "overlap") {
          throw new BatchAvailabilityConflictError("ช่วงเวลาที่เลือกซ้อนกับตารางแพทย์เดิม");
        }

        const createdSlots = [];

        for (const slot of requestedSlots) {
          createdSlots.push(
            await tx.doctorAvailability.create({
              data: slot
            })
          );
        }

        await Promise.all(
          createdSlots.map((slot) =>
            writeAuditLog(tx, {
              actorId: session.userId,
              action: "doctor_availability.bulk_create",
              entityType: "doctor_availability",
              entityId: slot.id,
              metadata: {
                doctorId: slot.doctorId,
                weekday: slot.weekday,
                startTime: slot.startTime,
                endTime: slot.endTime,
                slotMinutes: slot.slotMinutes,
                isActive: slot.isActive,
                batchSize: requestedSlots.length
              }
            })
          )
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof BatchAvailabilityConflictError
          ? error.message
          : "ไม่สามารถบันทึกตารางหลายวันได้ รายการทั้งหมดจึงไม่ถูกเปลี่ยนแปลง"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");

  return {
    status: "success",
    message: `บันทึกเวลาว่าง ${requestedSlots.length} ช่วงเรียบร้อยแล้ว`
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

export async function createDoctorAvailabilityDateOverrideAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = createDoctorAvailabilityDateOverrideSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return { status: "error", message: "ข้อมูลตารางพิเศษไม่ถูกต้อง กรุณาตรวจสอบวันที่และเวลา" };
  }

  const scheduleDate = parseScheduleDate(parsed.data.scheduleDate);

  try {
    await prisma.$transaction(
      async (tx) => {
        const doctor = await tx.doctor.findUnique({ where: { id: parsed.data.doctorId }, select: { id: true, status: true } });

        if (!doctor || doctor.status !== "approved") {
          throw new Error("Doctor is not approved.");
        }

        const existing = await tx.doctorAvailabilityDateOverride.findMany({
          where: { doctorId: doctor.id, scheduleDate, isActive: true },
          select: { type: true, startTime: true, endTime: true, slotMinutes: true }
        });

        if (parsed.data.type === "closed") {
          const booking = await findActiveBookingOnScheduleDate(tx, doctor.id, scheduleDate);
          if (booking) {
            throw new DateOverrideConflictError("กำหนดวันหยุดไม่ได้ เพราะมีนัดหมายในวันที่เลือกแล้ว");
          }

          if (existing.length > 0) {
            throw new DateOverrideConflictError("วันที่เลือกมีตารางพิเศษอยู่แล้ว กรุณาปิดใช้งานรายการเดิมก่อน");
          }
        } else {
          if (existing.some((item) => item.type === "closed")) {
            throw new DateOverrideConflictError("วันที่เลือกถูกกำหนดเป็นวันหยุดอยู่ กรุณาปิดใช้งานวันหยุดก่อน");
          }

          const candidate = {
            startTime: parsed.data.startTime!,
            endTime: parsed.data.endTime!,
            slotMinutes: parsed.data.slotMinutes!
          };
          const existingBlocks = existing.flatMap((item) =>
            item.type === "available" && item.startTime && item.endTime && item.slotMinutes
              ? [{ startTime: item.startTime, endTime: item.endTime, slotMinutes: item.slotMinutes }]
              : []
          );

          if (hasOverlappingTimeBlock(existingBlocks, candidate)) {
            throw new DateOverrideConflictError("ช่วงเวลาพิเศษซ้อนกับรายการเดิมของวันที่เลือก");
          }

          const recurring = await tx.doctorAvailability.findMany({
            where: { doctorId: doctor.id, weekday: scheduleDate.getUTCDay(), isActive: true },
            select: { startTime: true, endTime: true, slotMinutes: true }
          });

          if (hasOverlappingTimeBlock(recurring, candidate)) {
            throw new DateOverrideConflictError("ช่วงเวลาพิเศษซ้อนกับเวลาว่างประจำของแพทย์");
          }
        }

        const override = await tx.doctorAvailabilityDateOverride.create({
          data: {
            doctorId: doctor.id,
            scheduleDate,
            type: parsed.data.type,
            startTime: parsed.data.type === "available" ? parsed.data.startTime : null,
            endTime: parsed.data.type === "available" ? parsed.data.endTime : null,
            slotMinutes: parsed.data.type === "available" ? parsed.data.slotMinutes : null,
            notes: parsed.data.notes || null
          }
        });

        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "doctor_availability_date_override.create",
          entityType: "doctor_availability_date_override",
          entityId: override.id,
          metadata: { doctorId: doctor.id, scheduleDate: parsed.data.scheduleDate, type: override.type, startTime: override.startTime, endTime: override.endTime, slotMinutes: override.slotMinutes }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    return { status: "error", message: error instanceof DateOverrideConflictError ? error.message : "ไม่สามารถบันทึกตารางพิเศษได้" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");
  revalidatePath("/consult");

  return { status: "success", message: "บันทึกตารางพิเศษเรียบร้อยแล้ว" };
}

export async function toggleDoctorAvailabilityDateOverrideAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = toggleDoctorAvailabilityDateOverrideSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return { status: "error", message: "คำขอปรับสถานะตารางพิเศษไม่ถูกต้อง" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.doctorAvailabilityDateOverride.findUnique({ where: { id: parsed.data.overrideId } });
      if (!current) throw new Error("Override not found.");

      if (!parsed.data.isActive) {
        const booking = await findActiveBookingOnScheduleDate(tx, current.doctorId, current.scheduleDate);
        if (booking) {
          throw new DateOverrideConflictError("ปิดใช้งานไม่ได้ เพราะมีนัดหมายในวันที่เลือกแล้ว");
        }
      }

      const override = await tx.doctorAvailabilityDateOverride.update({
        where: { id: parsed.data.overrideId },
        data: { isActive: parsed.data.isActive }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "doctor_availability_date_override.toggle",
        entityType: "doctor_availability_date_override",
        entityId: override.id,
        metadata: { doctorId: override.doctorId, isActive: override.isActive }
      });
    });
  } catch (error) {
    return { status: "error", message: error instanceof DateOverrideConflictError ? error.message : "ไม่สามารถปรับสถานะตารางพิเศษได้" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");
  revalidatePath("/consult");

  return { status: "success", message: "ปรับสถานะตารางพิเศษเรียบร้อยแล้ว" };
}

export async function deleteDoctorAvailabilityDateOverrideAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = deleteDoctorAvailabilityDateOverrideSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return { status: "error", message: "ยืนยันการลบรายการไม่ถูกต้อง" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const override = await tx.doctorAvailabilityDateOverride.findUnique({ where: { id: parsed.data.overrideId } });
      if (!override) throw new Error("Override not found.");

      const booking = await findActiveBookingOnScheduleDate(tx, override.doctorId, override.scheduleDate);

      if (booking) throw new DateOverrideConflictError("ลบไม่ได้ เพราะมีนัดหมายของวันที่นี้แล้ว ให้ปิดใช้งานแทน");

      await tx.doctorAvailabilityDateOverride.delete({ where: { id: override.id } });
      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "doctor_availability_date_override.delete",
        entityType: "doctor_availability_date_override",
        entityId: override.id,
        metadata: { doctorId: override.doctorId, scheduleDate: override.scheduleDate.toISOString(), type: override.type }
      });
    });
  } catch (error) {
    return { status: "error", message: error instanceof DateOverrideConflictError ? error.message : "ไม่สามารถลบตารางพิเศษได้" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");
  revalidatePath("/consult");
  return { status: "success", message: "ลบตารางพิเศษเรียบร้อยแล้ว" };
}
