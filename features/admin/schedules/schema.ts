import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

const availabilityBlockSchema = z.object({
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern),
  slotMinutes: z.coerce.number().int().min(10).max(240)
});

export const createDoctorAvailabilityDateOverrideSchema = z
  .object({
    doctorId: z.string().min(1),
    scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(["available", "closed"]),
    startTime: z.string().regex(timePattern).optional(),
    endTime: z.string().regex(timePattern).optional(),
    slotMinutes: z.coerce.number().int().min(10).max(240).optional(),
    notes: z.string().max(500).optional()
  })
  .superRefine((value, context) => {
    if (value.type === "closed") {
      return;
    }

    if (!value.startTime || !value.endTime || !value.slotMinutes) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "กรุณาระบุช่วงเวลาและระยะเวลาต่อรอบ", path: ["startTime"] });
      return;
    }

    const start = timeToMinutes(value.startTime);
    const end = timeToMinutes(value.endTime);

    if (start >= end) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม", path: ["endTime"] });
    } else if ((end - start) % value.slotMinutes !== 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "ระยะเวลาต่อรอบต้องหารช่วงเวลาได้ลงตัว", path: ["slotMinutes"] });
    }
  });

export const toggleDoctorAvailabilityDateOverrideSchema = z.object({
  overrideId: z.string().min(1),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true")
});

export const deleteDoctorAvailabilityDateOverrideSchema = z.object({
  overrideId: z.string().min(1),
  confirm: z.literal("delete")
});

export const upsertDoctorAvailabilitySchema = z
  .object({
    availabilityId: z.string().optional(),
    doctorId: z.string().min(1),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
    slotMinutes: z.coerce.number().int().min(10).max(240),
    isActive: z
      .enum(["on", "true", "false"])
      .optional()
      .transform((value) => value === "on" || value === "true"),
    notes: z.string().max(500).optional()
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
    path: ["endTime"]
  });

export const toggleDoctorAvailabilitySchema = z.object({
  availabilityId: z.string().min(1),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true")
});

export const createDoctorAvailabilityBatchSchema = z
  .object({
    doctorId: z.string().min(1),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1),
    blocks: z.array(availabilityBlockSchema).min(1),
    isActive: z
      .enum(["on", "true", "false"])
      .optional()
      .transform((value) => value === "on" || value === "true"),
    notes: z.string().max(500).optional()
  })
  .superRefine((value, context) => {
    if (new Set(value.weekdays).size !== value.weekdays.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "เลือกวันซ้ำ กรุณาเลือกแต่ละวันเพียงครั้งเดียว",
        path: ["weekdays"]
      });
    }

    for (const [index, block] of value.blocks.entries()) {
      const start = timeToMinutes(block.startTime);
      const end = timeToMinutes(block.endTime);

      if (start >= end) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม",
          path: ["blocks", index, "endTime"]
        });
        continue;
      }

      if ((end - start) % block.slotMinutes !== 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ระยะเวลาต่อรอบต้องหารช่วงเวลาได้ลงตัว",
          path: ["blocks", index, "slotMinutes"]
        });
      }
    }

    for (let left = 0; left < value.blocks.length; left += 1) {
      for (let right = left + 1; right < value.blocks.length; right += 1) {
        const first = value.blocks[left];
        const second = value.blocks[right];
        const firstStart = timeToMinutes(first.startTime);
        const firstEnd = timeToMinutes(first.endTime);
        const secondStart = timeToMinutes(second.startTime);
        const secondEnd = timeToMinutes(second.endTime);

        if (first.startTime === second.startTime && first.endTime === second.endTime && first.slotMinutes === second.slotMinutes) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "มีช่วงเวลาเดียวกันซ้ำในรายการ",
            path: ["blocks", right]
          });
        } else if (firstStart < secondEnd && secondStart < firstEnd) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "ช่วงเวลาห้ามซ้อนกัน",
            path: ["blocks", right]
          });
        }
      }
    }
  });

export type CreateDoctorAvailabilityBatchInput = z.infer<typeof createDoctorAvailabilityBatchSchema>;
