import { z } from "zod";

export const reviewPrescriptionSchema = z.object({
  prescriptionId: z.string().min(1),
  status: z.enum(["verified", "rejected"])
});
