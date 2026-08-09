import { z } from "zod";

export const verifyConsultationSlipSchema = z
  .object({
    consultationId: z.string().min(1),
    attachmentId: z.string().trim().min(1).max(191)
  })
  .strict();
