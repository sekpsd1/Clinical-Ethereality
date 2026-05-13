import { z } from "zod";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

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
    message: "End time must be after start time.",
    path: ["endTime"]
  });

export const toggleDoctorAvailabilitySchema = z.object({
  availabilityId: z.string().min(1),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true")
});
