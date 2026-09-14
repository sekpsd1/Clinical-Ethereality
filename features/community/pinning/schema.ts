import { z } from "zod";

export const updateArticlePinSchema = z.object({
  articleId: z.string().trim().min(1),
  action: z.enum(["pin", "unpin"])
});

export type ArticlePinAction = z.infer<typeof updateArticlePinSchema>["action"];
