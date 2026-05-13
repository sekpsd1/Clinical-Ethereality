import { z } from "zod";

export const updateModerationItemSchema = z.object({
  itemId: z.string().min(1),
  itemType: z.enum(["article", "comment"]),
  action: z.enum(["restore", "hide", "archive"])
});
