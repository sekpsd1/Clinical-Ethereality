import { z } from "zod";

export const updatePharmacistOrderSchema = z.object({
  orderId: z.string().min(1),
  action: z.enum(["mark_preparing", "mark_shipped", "mark_delivered"])
});
