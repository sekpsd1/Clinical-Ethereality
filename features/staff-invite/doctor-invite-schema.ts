import { z } from "zod";

export const doctorInviteIdempotencyKeySchema = z
  .string()
  .trim()
  .uuid("รหัสคำขอสร้างลิงก์เชิญไม่ถูกต้อง");

export const issueDoctorInvitationSchema = z.object({
  idempotencyKey: doctorInviteIdempotencyKeySchema,
  origin: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "ที่อยู่เว็บไซต์ไม่ถูกต้อง")
});

export const revokeDoctorInvitationSchema = z.object({
  invitationId: z.string().trim().min(1).max(191)
});

export const doctorInviteRawTokenSchema = z.string().trim().min(80).max(191);
export const doctorInviteTicketSchema = z.string().trim().min(80).max(320);
