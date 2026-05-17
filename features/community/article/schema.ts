import { z } from "zod";

export const articleIdSchema = z.string().min(1);

export const commentSchema = z.object({
  articleId: z.string().min(1),
  body: z.string().trim().min(1).max(800)
});

export const reportContentSchema = z.object({
  itemId: z.string().min(1),
  reason: z.string().trim().max(240).optional()
});
