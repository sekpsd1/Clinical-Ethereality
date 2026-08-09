import { z } from "zod";

export const verifyConsultationSlipSchema = z
  .object({
    consultationId: z.string().min(1),
    qrPayload: z.string().trim().optional(),
    imageUrl: z.string().trim().url().optional().or(z.literal(""))
  })
  .refine((value) => Boolean(value.qrPayload?.trim()) !== Boolean(value.imageUrl), {
    message: "Exactly one of QR payload or hosted slip image URL is required."
  });
