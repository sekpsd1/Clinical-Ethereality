import { z } from "zod";

export const adminUserIdSchema = z.object({
  userId: z.string().min(1)
});

export const approveStaffRoleSchema = adminUserIdSchema.extend({
  role: z.enum(["doctor", "pharmacist", "admin"])
});

export const updateUserStatusSchema = adminUserIdSchema.extend({
  status: z.enum(["active", "suspended", "archived"])
});
