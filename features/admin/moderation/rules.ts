import type { ArticleStatus, CommentStatus, CommunityReportStatus } from "@prisma/client";

export type ModerationAction = "restore" | "hide" | "archive";
export type ModerationItemType = "article" | "comment";

export function getModerationNextStatus(
  itemType: ModerationItemType,
  action: ModerationAction
): ArticleStatus | CommentStatus {
  if (action === "restore") {
    return itemType === "article" ? "published" : "visible";
  }

  return action === "hide" ? "hidden" : "archived";
}

export function getReportResolutionStatus(action: ModerationAction): CommunityReportStatus {
  return action === "restore" ? "dismissed" : "actioned";
}
