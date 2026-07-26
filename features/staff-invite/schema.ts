import { z } from "zod";
import {
  doctorSpecialtyValues,
  formatDoctorSpecialties
} from "@/features/staff-invite/doctor-specialties";

export const staffInviteRoleSchema = z.enum(["doctor", "pharmacist", "admin"]);

export const staffInviteRequestSchema = z
  .object({
    role: staffInviteRoleSchema,
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    licenseNumber: z.string().trim().max(80).optional(),
    specialties: z
      .array(z.enum(doctorSpecialtyValues))
      .max(3, "เลือกความเชี่ยวชาญได้ไม่เกิน 3 รายการ")
      .optional(),
    otherSpecialty: z.string().trim().max(80).optional(),
    pharmacyName: z.string().trim().max(160).optional()
  })
  .superRefine((data, context) => {
    if (data.role === "admin") {
      return;
    }

    if (!data.firstName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstName"],
        message: "กรุณาระบุชื่อ"
      });
    }

    if (!data.lastName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastName"],
        message: "กรุณาระบุนามสกุล"
      });
    }

    if (data.role === "doctor") {
      if (!data.specialties || data.specialties.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["specialties"],
          message: "กรุณาเลือกความเชี่ยวชาญอย่างน้อย 1 รายการ"
        });
      }

      if (data.specialties?.includes("other") && !data.otherSpecialty) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["otherSpecialty"],
          message: "กรุณาระบุความเชี่ยวชาญอื่น ๆ"
        });
      }

      if (
        data.specialties &&
        formatDoctorSpecialties(data.specialties, data.otherSpecialty).length > 191
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["specialties"],
          message: "ข้อมูลความเชี่ยวชาญยาวเกินกำหนด"
        });
      }
    }
  });

export type StaffInviteRole = z.infer<typeof staffInviteRoleSchema>;
export type StaffInviteRequestData = z.infer<typeof staffInviteRequestSchema>;
