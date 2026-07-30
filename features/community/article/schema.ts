import { z } from "zod";
import { communityReportReasons } from "@/features/community/policy";

export const articleIdSchema = z.string().min(1);

export const commentSchema = z.object({
  articleId: z.string().min(1),
  body: z.string().trim().min(1).max(800)
});

export const reportContentSchema = z.object({
  itemId: z.string().min(1),
  itemType: z.enum(["article", "comment"]),
  articleSlug: z.string().trim().min(1).max(191),
  reason: z.enum(communityReportReasons.map((item) => item.value) as [
    (typeof communityReportReasons)[number]["value"],
    ...(typeof communityReportReasons)[number]["value"][]
  ]),
  details: z.string().trim().max(500).optional()
});
