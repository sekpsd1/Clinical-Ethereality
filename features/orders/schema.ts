import { z } from "zod";

export const cancelCustomerOrderSchema = z.object({
  orderId: z.string().trim().min(1).max(191)
});
