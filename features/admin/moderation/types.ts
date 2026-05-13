import type { ArticleStatus, CommentStatus } from "@prisma/client";

export type AdminModerationItemType = "article" | "comment";

export type AdminModerationQueueItem = {
  id: string;
  type: AdminModerationItemType;
  title: string;
  body: string;
  authorName: string;
  authorLineId: string;
  status: ArticleStatus | CommentStatus;
  createdAt: string;
};

export type AdminModerationData = {
  items: AdminModerationQueueItem[];
  summary: {
    hiddenArticles: number;
    hiddenComments: number;
    archived: number;
  };
  unavailable?: boolean;
};
