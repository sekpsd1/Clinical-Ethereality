import { z } from "zod";

export const staffInviteRoleSchema = z.enum(["doctor", "pharmacist", "admin"]);

export const staffInviteRequestSchema = z.object({
  role: staffInviteRoleSchema,
  licenseNumber: z.string().trim().max(80).optional(),
  specialty: z.string().trim().max(160).optional(),
  pharmacyName: z.string().trim().max(160).optional()
});

export type StaffInviteRole = z.infer<typeof staffInviteRoleSchema>;
