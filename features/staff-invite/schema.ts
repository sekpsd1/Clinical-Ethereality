import { z } from "zod";

export const staffInviteRoleSchema = z.enum(["doctor", "pharmacist", "admin"]);

export const staffInviteRequestSchema = z
  .object({
    role: staffInviteRoleSchema,
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    licenseNumber: z.string().trim().max(80).optional(),
    specialty: z.string().trim().max(160).optional(),
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
  });

export type StaffInviteRole = z.infer<typeof staffInviteRoleSchema>;
