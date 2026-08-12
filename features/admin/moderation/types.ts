import type { ArticleStatus, CommentStatus } from "@prisma/client";

export type AdminModerationItemType = "article" | "comment";

export type AdminModerationQueueItem = {
  id: string;
  reportId: string | null;
  type: AdminModerationItemType;
  title: string;
  body: string;
  authorName: string;
  status: ArticleStatus | CommentStatus;
  createdAt: string;
  reporterName: string | null;
  reportReasonCode: string | null;
  reportReason: string | null;
  reportDetails: string | null;
  reportedAt: string | null;
};

export type AdminModerationData = {
  items: AdminModerationQueueItem[];
  summary: {
    pendingReports: number;
    hiddenArticles: number;
    hiddenComments: number;
  };
  unavailable?: boolean;
};
