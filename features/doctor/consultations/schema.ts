import { z } from "zod";

export const submitPrescriptionSchema = z.object({
  consultationId: z.string().min(1),
  productId: z.string().trim().min(1).max(191),
  dosage: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().positive().max(999),
  instructions: z.string().trim().min(2).max(1000),
  warnings: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(2000).optional()
});
