import { z } from "zod";

export const verifyConsultationSlipSchema = z
  .object({
    consultationId: z.string().min(1),
    qrPayload: z.string().trim().optional(),
    imageUrl: z.string().trim().url().optional().or(z.literal(""))
  })
  .refine((value) => Boolean(value.qrPayload || value.imageUrl), {
    message: "QR payload or hosted slip image URL is required."
  });
