import { z } from "zod";

export const submitPrescriptionSchema = z.object({
  consultationId: z.string().min(1),
  notes: z.string().trim().min(5).max(2000)
});
