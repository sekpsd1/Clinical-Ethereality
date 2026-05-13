import { z } from "zod";

export const reviewPaymentSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(["verified", "rejected"])
});
