"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { buildBatchAvailabilityRecords, findExistingAvailabilityConflict } from "@/features/admin/schedules/bulk";
import { getBangkokDayRange, getBangkokScheduleDateValue, hasOverlappingTimeBlock, isPastScheduleDate, parseScheduleDate } from "@/features/admin/schedules/date-overrides";
import { getDoctorScheduleDeactivateConflict, isCancelledTestResetPayment } from "@/features/admin/schedules/bulk-deactivate";
import {
  copyDoctorAvailabilityDateOverridesSchema,
  createDoctorAvailabilityDateOverrideSchema,
  deleteDoctorAvailabilityDateOverrideSchema,
  createDoctorAvailabilityBatchSchema,
  deactivateAllDoctorSchedulesSchema,
  toggleDoctorAvailabilityDateOverrideSchema,
  toggleDoctorAvailabilitySchema,
  updateDoctorAvailabilityDateOverrideSchema,
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
    effectiveFrom: formData.get("effectiveFrom") ?? "",
    effectiveTo: formData.get("effectiveTo") ?? ""
  };
}

function formDataToDateCopyObject(formData: FormData) {
  return {
    doctorId: formData.get("doctorId"),
    sourceDate: formData.get("sourceDate"),
    targetDates: formData.getAll("targetDates"),
    confirm: formData.get("confirm")
  };
}

class BatchAvailabilityConflictError extends Error {}
class DateOverrideConflictError extends Error {}
class ScheduleBookingSafetyError extends Error {}

async function getDoctorScheduleDeactivatePreflight(tx: Prisma.TransactionClient, now: Date) {
  const doctors = await tx.doctor.findMany({
    where: { status: "approved", user: { status: "active" } },
    select: { id: true }
  });
  const doctorIds = doctors.map((doctor) => doctor.id);
  const [activeConsultations, pendingPaymentRows, activeSlotLocks] = await Promise.all([
    tx.consultation.count({ where: { doctorId: { in: doctorIds }, status: { notIn: ["completed", "cancelled"] } } }),
    tx.payment.findMany({
      where: { status: { in: ["pending_slip", "pending_review"] }, consultation: { doctorId: { in: doctorIds } } },
      select: { id: true, verificationPayload: true, consultation: { select: { id: true, status: true } } }
    }),
    tx.consultationSlotLock.count({ where: { doctorId: { in: doctorIds }, expiresAt: { gt: now } } })
  ]);

  const pendingPayments = pendingPaymentRows.filter((payment) => !isCancelledTestResetPayment(payment)).length;
  return { doctorIds, activeConsultations, pendingPayments, activeSlotLocks };
}

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

async function findFutureBookingForDoctor(tx: Prisma.TransactionClient, doctorId: string) {
  return tx.consultation.findFirst({
    where: {
      doctorId,
      scheduledAt: { gte: new Date() },
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

      const existingSlot = availabilityId
        ? await tx.doctorAvailability.findUnique({ where: { id: availabilityId }, select: { id: true, doctorId: true } })
        : null;

      if (availabilityId && (!existingSlot || existingSlot.doctorId !== data.doctorId)) {
        throw new Error("Availability not found.");
      }

      if (availabilityId && await findFutureBookingForDoctor(tx, data.doctorId)) {
        throw new ScheduleBookingSafetyError("แก้ไขตารางประจำไม่ได้ เพราะแพทย์มีนัดหมายในอนาคตอยู่แล้ว กรุณาจัดการนัดหมายก่อน");
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
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ScheduleBookingSafetyError ? error.message : "ไม่สามารถบันทึกตารางแพทย์ได้ กรุณาลองใหม่"
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
      if (!parsed.data.isActive) {
        const current = await tx.doctorAvailability.findUnique({ where: { id: parsed.data.availabilityId }, select: { doctorId: true } });
        if (!current) throw new Error("Availability not found.");
        if (await findFutureBookingForDoctor(tx, current.doctorId)) {
          throw new ScheduleBookingSafetyError("ปิดช่วงเวลาประจำไม่ได้ เพราะแพทย์มีนัดหมายในอนาคตอยู่แล้ว");
        }
      }

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
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ScheduleBookingSafetyError ? error.message : "ไม่สามารถปรับสถานะตารางได้"
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

export async function deactivateAllDoctorSchedulesAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = deactivateAllDoctorSchedulesSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) return { status: "error", message: "กรุณาพิมพ์ข้อความยืนยันให้ถูกต้อง" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const today = parseScheduleDate(getBangkokScheduleDateValue(now));
      const { doctorIds, activeConsultations, pendingPayments, activeSlotLocks } = await getDoctorScheduleDeactivatePreflight(tx, now);
      const conflict = getDoctorScheduleDeactivateConflict({ targetDoctors: doctorIds.length, activeConsultations, pendingPayments, activeSlotLocks });
      if (conflict) throw new ScheduleBookingSafetyError(conflict);

      const [availability, overrides] = await Promise.all([
        tx.doctorAvailability.updateMany({ where: { doctorId: { in: doctorIds }, isActive: true }, data: { isActive: false } }),
        tx.doctorAvailabilityDateOverride.updateMany({ where: { doctorId: { in: doctorIds }, scheduleDate: { gte: today }, isActive: true }, data: { isActive: false } })
      ]);

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "doctor_schedule.bulk_deactivate",
        entityType: "doctor_schedule",
        metadata: { doctorCount: doctorIds.length, recurringAvailabilityCount: availability.count, futureDateOverrideCount: overrides.count, scheduleFrom: getBangkokScheduleDateValue(now) }
      });

      return { doctorCount: doctorIds.length, recurringAvailabilityCount: availability.count, futureDateOverrideCount: overrides.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidatePath("/admin");
    revalidatePath("/admin/schedules");
    revalidatePath("/admin/audit");
    revalidatePath("/consult");
    return { status: "success", message: `ปิดตารางประจำ ${result.recurringAvailabilityCount} รายการ และเวลาพิเศษในอนาคต ${result.futureDateOverrideCount} รายการของแพทย์ ${result.doctorCount} คนแล้ว` };
  } catch (error) {
    return { status: "error", message: error instanceof ScheduleBookingSafetyError ? error.message : "ไม่สามารถปิดตารางทั้งหมดได้" };
  }
}

export async function previewDeactivateAllDoctorSchedulesAction(
  _previousState: AdminScheduleActionState
): Promise<AdminScheduleActionState> {
  void _previousState;
  await requireAdminSession();

  try {
    const preflight = await prisma.$transaction((tx) => getDoctorScheduleDeactivatePreflight(tx, new Date()), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    const conflict = getDoctorScheduleDeactivateConflict({
      targetDoctors: preflight.doctorIds.length,
      activeConsultations: preflight.activeConsultations,
      pendingPayments: preflight.pendingPayments,
      activeSlotLocks: preflight.activeSlotLocks
    });
    if (conflict) return { status: "error", message: `${conflict} (นัดหมาย ${preflight.activeConsultations}, ชำระเงินค้าง ${preflight.pendingPayments}, slot lock ${preflight.activeSlotLocks})` };
    return { status: "success", message: `ผ่านการตรวจสอบ: แพทย์ ${preflight.doctorIds.length} คน, นัดหมายที่ยังไม่จบ 0, ชำระเงินค้าง 0, slot lock 0` };
  } catch {
    return { status: "error", message: "ไม่สามารถตรวจสอบก่อนปิดตารางได้" };
  }
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

  if (isPastScheduleDate(parsed.data.scheduleDate)) {
    return { status: "error", message: "ไม่สามารถเพิ่มตารางในวันย้อนหลังได้" };
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

export async function updateDoctorAvailabilityDateOverrideAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = updateDoctorAvailabilityDateOverrideSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return { status: "error", message: "ข้อมูลตารางของวันนั้นไม่ถูกต้อง กรุณาตรวจสอบวันที่และเวลา" };
  }

  if (isPastScheduleDate(parsed.data.scheduleDate)) {
    return { status: "error", message: "ไม่สามารถแก้ไขตารางในวันย้อนหลังได้" };
  }

  const scheduleDate = parseScheduleDate(parsed.data.scheduleDate);

  try {
    await prisma.$transaction(
      async (tx) => {
        const current = await tx.doctorAvailabilityDateOverride.findUnique({ where: { id: parsed.data.overrideId } });
        if (!current || current.doctorId !== parsed.data.doctorId || current.scheduleDate.getTime() !== scheduleDate.getTime()) {
          throw new Error("Date override not found.");
        }

        if (await findActiveBookingOnScheduleDate(tx, current.doctorId, scheduleDate)) {
          throw new DateOverrideConflictError("แก้ไขช่วงเวลานี้ไม่ได้ เพราะมีนัดหมายในวันที่เลือกแล้ว");
        }

        const otherOverrides = await tx.doctorAvailabilityDateOverride.findMany({
          where: { doctorId: current.doctorId, scheduleDate, isActive: true, id: { not: current.id } },
          select: { type: true, startTime: true, endTime: true, slotMinutes: true }
        });

        if (parsed.data.type === "closed") {
          if (otherOverrides.length > 0) throw new DateOverrideConflictError("วันที่เลือกมีเวลาพิเศษอยู่แล้ว กรุณาลบหรือปิดใช้งานรายการอื่นก่อน");
        } else {
          if (otherOverrides.some((item) => item.type === "closed")) throw new DateOverrideConflictError("วันที่เลือกเป็นวันหยุดอยู่ กรุณาปิดใช้งานวันหยุดก่อน");
          const candidate = { startTime: parsed.data.startTime!, endTime: parsed.data.endTime!, slotMinutes: parsed.data.slotMinutes! };
          const otherBlocks = otherOverrides.flatMap((item) => item.type === "available" && item.startTime && item.endTime && item.slotMinutes ? [{ startTime: item.startTime, endTime: item.endTime, slotMinutes: item.slotMinutes }] : []);
          if (hasOverlappingTimeBlock(otherBlocks, candidate)) throw new DateOverrideConflictError("ช่วงเวลาซ้อนกับรายการอื่นของวันที่เลือก");
          const recurring = await tx.doctorAvailability.findMany({ where: { doctorId: current.doctorId, weekday: scheduleDate.getUTCDay(), isActive: true }, select: { startTime: true, endTime: true, slotMinutes: true } });
          if (hasOverlappingTimeBlock(recurring, candidate)) throw new DateOverrideConflictError("ช่วงเวลาซ้อนกับเวลาว่างประจำของแพทย์");
        }

        const override = await tx.doctorAvailabilityDateOverride.update({
          where: { id: current.id },
          data: {
            type: parsed.data.type,
            startTime: parsed.data.type === "available" ? parsed.data.startTime : null,
            endTime: parsed.data.type === "available" ? parsed.data.endTime : null,
            slotMinutes: parsed.data.type === "available" ? parsed.data.slotMinutes : null,
            notes: parsed.data.notes || null
          }
        });
        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "doctor_availability_date_override.update",
          entityType: "doctor_availability_date_override",
          entityId: override.id,
          metadata: { doctorId: override.doctorId, scheduleDate: parsed.data.scheduleDate, type: override.type, startTime: override.startTime, endTime: override.endTime, slotMinutes: override.slotMinutes }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    return { status: "error", message: error instanceof DateOverrideConflictError ? error.message : "ไม่สามารถแก้ไขตารางของวันนั้นได้" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");
  revalidatePath("/consult");
  return { status: "success", message: "แก้ไขช่วงเวลาตรวจเรียบร้อยแล้ว" };
}

export async function copyDoctorAvailabilityDateOverridesAction(
  _previousState: AdminScheduleActionState,
  formData: FormData
): Promise<AdminScheduleActionState> {
  const session = await requireAdminSession();
  const parsed = copyDoctorAvailabilityDateOverridesSchema.safeParse(formDataToDateCopyObject(formData));

  if (!parsed.success) return { status: "error", message: "ข้อมูลวันต้นทางหรือวันปลายทางไม่ถูกต้อง" };
  if (parsed.data.targetDates.some((date) => isPastScheduleDate(date))) return { status: "error", message: "ไม่สามารถคัดลอกไปยังวันย้อนหลังได้" };

  try {
    await prisma.$transaction(
      async (tx) => {
        const doctor = await tx.doctor.findUnique({ where: { id: parsed.data.doctorId }, select: { id: true, status: true } });
        if (!doctor || doctor.status !== "approved") throw new Error("Doctor is not approved.");

        const sourceDate = parseScheduleDate(parsed.data.sourceDate);
        const sourceOverrides = await tx.doctorAvailabilityDateOverride.findMany({
          where: { doctorId: doctor.id, scheduleDate: sourceDate, isActive: true },
          select: { type: true, startTime: true, endTime: true, slotMinutes: true, notes: true }
        });
        if (sourceOverrides.length === 0) throw new DateOverrideConflictError("วันที่ต้นทางไม่มีตารางพิเศษให้คัดลอก");

        for (const targetDateValue of parsed.data.targetDates) {
          const targetDate = parseScheduleDate(targetDateValue);
          const booking = await findActiveBookingOnScheduleDate(tx, doctor.id, targetDate);
          if (booking) throw new DateOverrideConflictError(`คัดลอกไม่ได้ เพราะ ${targetDateValue} มีนัดหมายอยู่แล้ว`);

          const existing = await tx.doctorAvailabilityDateOverride.findMany({
            where: { doctorId: doctor.id, scheduleDate: targetDate, isActive: true },
            select: { type: true, startTime: true, endTime: true, slotMinutes: true }
          });
          if (existing.length > 0) throw new DateOverrideConflictError(`คัดลอกไม่ได้ เพราะ ${targetDateValue} มีตารางพิเศษอยู่แล้ว`);

          for (const source of sourceOverrides) {
            if (source.type === "available" && source.startTime && source.endTime && source.slotMinutes) {
              const recurring = await tx.doctorAvailability.findMany({ where: { doctorId: doctor.id, weekday: targetDate.getUTCDay(), isActive: true }, select: { startTime: true, endTime: true, slotMinutes: true } });
              if (hasOverlappingTimeBlock(recurring, { startTime: source.startTime, endTime: source.endTime, slotMinutes: source.slotMinutes })) {
                throw new DateOverrideConflictError(`คัดลอกไม่ได้ เพราะ ${targetDateValue} มีเวลาประจำซ้อนกับช่วงที่จะคัดลอก`);
              }
            }

            const override = await tx.doctorAvailabilityDateOverride.create({
              data: { doctorId: doctor.id, scheduleDate: targetDate, type: source.type, startTime: source.startTime, endTime: source.endTime, slotMinutes: source.slotMinutes, notes: source.notes }
            });
            await writeAuditLog(tx, {
              actorId: session.userId,
              action: "doctor_availability_date_override.copy",
              entityType: "doctor_availability_date_override",
              entityId: override.id,
              metadata: { doctorId: doctor.id, sourceDate: parsed.data.sourceDate, targetDate: targetDateValue, type: override.type, startTime: override.startTime, endTime: override.endTime, slotMinutes: override.slotMinutes }
            });
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    return { status: "error", message: error instanceof DateOverrideConflictError ? error.message : "ไม่สามารถคัดลอกตารางของวันนั้นได้" };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/schedules");
  revalidatePath("/admin/audit");
  revalidatePath("/consult");
  return { status: "success", message: `คัดลอกตารางพิเศษไปยัง ${parsed.data.targetDates.length} วันเรียบร้อยแล้ว` };
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
