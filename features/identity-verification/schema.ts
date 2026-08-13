import { z } from "zod";
import { normalizeThaiMobileNumber } from "@/lib/identity/thai-phone";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const requestPhoneVerificationSchema = z.object({
  fullName: z.string().trim().min(2, "กรุณาระบุชื่อ-นามสกุล").max(191, "ชื่อยาวเกินไป"),
  dateOfBirth: z.string().regex(isoDatePattern, "กรุณาระบุวันเกิด").refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date <= new Date();
  }, "วันเกิดไม่ถูกต้อง"),
  phone: z.string().trim().min(1, "กรุณาระบุเบอร์โทรศัพท์").refine((value) => {
    try {
      normalizeThaiMobileNumber(value);
      return true;
    } catch {
      return false;
    }
  }, "กรุณาระบุเบอร์มือถือไทย เช่น 0812345678")
});

export const verifyPhoneVerificationSchema = z.object({
  challengeId: z.string().cuid(),
  code: z.string().trim().regex(/^\d{4,8}$/, "กรุณาระบุรหัส OTP เป็นตัวเลข")
});

export type RequestPhoneVerificationInput = z.infer<typeof requestPhoneVerificationSchema>;
