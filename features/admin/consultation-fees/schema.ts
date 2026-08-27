import { z } from "zod";

export const MIN_CONSULTATION_FEE_SATANG = 100;
export const MAX_CONSULTATION_FEE_SATANG = 10_000_000;

const exactBahtAmountPattern = /^(0|[1-9]\d{0,5})\.\d{2}$/;

function parseExactBahtAmountToSatang(value: string): number {
  const [bahtPart, satangPart] = value.split(".");

  return Number(bahtPart) * 100 + Number(satangPart);
}

export const consultationFeeAmountSchema = z
  .string()
  .trim()
  .regex(exactBahtAmountPattern, "กรุณาระบุจำนวนเงินเป็นบาทและทศนิยม 2 ตำแหน่ง เช่น 700.00")
  .transform(parseExactBahtAmountToSatang)
  .refine((satang) => satang >= MIN_CONSULTATION_FEE_SATANG, "ค่าปรึกษาต้องไม่น้อยกว่า 1.00 บาท")
  .refine((satang) => satang <= MAX_CONSULTATION_FEE_SATANG, "ค่าปรึกษาต้องไม่เกิน 100,000.00 บาท")
  .refine(
    (satang) => satang % 100 === 0,
    "ระบบปัจจุบันรองรับค่าปรึกษาเป็นจำนวนเต็มบาทเท่านั้น กรุณาใช้ .00"
  );

export const updateConsultationFeeSchema = z.object({
  doctorId: z.string().min(1).max(191),
  consultationFee: consultationFeeAmountSchema,
  expectedUpdatedAt: z.string().datetime({ offset: true })
});
