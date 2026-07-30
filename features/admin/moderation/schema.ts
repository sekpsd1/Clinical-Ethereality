import { z } from "zod";

export const updateModerationItemSchema = z.object({
  itemId: z.string().min(1),
  reportId: z.string().min(1).optional(),
  itemType: z.enum(["article", "comment"]),
  action: z.enum(["restore", "hide", "archive"])
});
