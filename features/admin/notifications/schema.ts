import { z } from "zod";

export const createNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["system", "consultation", "order", "payment", "prescription", "community", "reward"]),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().max(1000).optional()
});
