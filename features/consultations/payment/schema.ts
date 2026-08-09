import { z } from "zod";

export const verifyConsultationSlipSchema = z
  .object({
    consultationId: z.string().min(1),
    qrPayload: z.string().trim().optional(),
    imageUrl: z.string().trim().url().optional().or(z.literal("")),
    attachmentId: z.string().trim().min(1).max(191).optional()
  })
  .refine(
    (value) =>
      Number(Boolean(value.qrPayload?.trim())) + Number(Boolean(value.imageUrl)) + Number(Boolean(value.attachmentId)) === 1,
    {
      message: "Exactly one of QR payload, hosted slip image URL, or private attachment is required."
    }
  );
