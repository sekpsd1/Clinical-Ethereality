import { z } from "zod";

const thaiPhonePattern = /^(?:\+66|0)[689]\d{8}$/;

export const updateProfileContactSchema = z.object({
  email: z
    .string()
    .trim()
    .max(191, "อีเมลยาวเกินไป")
    .refine((value) => value === "" || z.string().email().safeParse(value).success, "รูปแบบอีเมลไม่ถูกต้อง")
    .transform((value) => value || undefined),
  phone: z
    .string()
    .trim()
    .max(30, "เบอร์โทรศัพท์ยาวเกินไป")
    .transform((value) => value.replace(/[\s-]/g, ""))
    .refine((value) => value === "" || thaiPhonePattern.test(value), "กรุณาระบุเบอร์โทรศัพท์ไทย เช่น 0812345678")
    .transform((value) => value || undefined)
});

export type UpdateProfileContactInput = z.infer<typeof updateProfileContactSchema>;
