import { z } from "zod";

export const adminUserIdSchema = z.object({
  userId: z.string().min(1)
});

export const deleteUserSchema = adminUserIdSchema;

export const approveStaffRoleSchema = adminUserIdSchema.extend({
  role: z.enum(["doctor", "pharmacist", "admin"])
});

export const updateUserStatusSchema = adminUserIdSchema.extend({
  status: z.enum(["active", "suspended", "archived"])
});

export const updateUserRoleSchema = adminUserIdSchema.extend({
  role: z.enum(["customer", "doctor", "pharmacist", "admin"])
});

export const manageDoctorProfileSchema = adminUserIdSchema.extend({
  intent: z.enum(["save", "approve"]),
  fullName: z.string().trim().min(2, "กรุณาระบุชื่อ-นามสกุลจริง").max(191, "ชื่อ-นามสกุลยาวเกินกำหนด"),
  specialty: z.string().trim().min(2, "กรุณาระบุสาขาความถนัด").max(191, "สาขาความถนัดยาวเกินกำหนด"),
  licenseNumber: z.string().trim().min(1, "กรุณาระบุเลขที่ใบประกอบวิชาชีพ").max(191, "เลขที่ใบประกอบวิชาชีพยาวเกินกำหนด"),
  bio: z.string().trim().max(4_000, "ประวัติหรือคำแนะนำแพทย์ยาวเกินกำหนด").optional()
});

export type ManageDoctorProfileData = z.infer<typeof manageDoctorProfileSchema>;
