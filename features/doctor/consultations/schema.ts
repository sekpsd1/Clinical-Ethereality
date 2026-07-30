import { z } from "zod";

export const submitPrescriptionSchema = z.object({
  consultationId: z.string().min(1),
  medicationName: z.string().trim().min(2).max(200),
  dosage: z.string().trim().min(1).max(120),
  quantity: z.string().trim().min(1).max(120),
  instructions: z.string().trim().min(2).max(1000),
  warnings: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional()
});
