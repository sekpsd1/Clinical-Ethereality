import { z } from "zod";

export const createPrescriptionOrderSchema = z.object({
  prescriptionId: z.string().min(1),
  productId: z.string().min(1)
});
