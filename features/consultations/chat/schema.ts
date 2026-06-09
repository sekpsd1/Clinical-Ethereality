import { z } from "zod";

export const sendConsultationMessageSchema = z.object({
  consultationId: z.string().min(1),
  body: z.string().trim().min(1).max(2000)
});
