import { z } from "zod";

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const thaiPhonePattern = /^(?:\+66|0)[689]\d{8}$/;

function isRealIsoDate(value: string): boolean {
  const match = isoDatePattern.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function getBangkokDateKey(now = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const updateProfileContactSchema = z.object({
  fullName: z.string().trim().min(2, "กรุณาระบุชื่อ-นามสกุล").max(191, "ชื่อยาวเกินไป").optional(),
  dateOfBirth: z
    .string()
    .trim()
    .refine(isRealIsoDate, "กรุณาระบุวันเดือนปีเกิดให้ถูกต้อง")
    .refine((value) => value <= getBangkokDateKey(), "วันเกิดต้องไม่เป็นวันในอนาคต")
    .optional(),
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
    .refine((value) => value === "" || thaiPhonePattern.test(value), "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง")
    .transform((value) => value || undefined)
    .optional()
}).strict();

export type UpdateProfileContactInput = z.infer<typeof updateProfileContactSchema>;
