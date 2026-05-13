import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminModerationData, AdminModerationQueueItem } from "@/features/admin/moderation/types";

type ArticleWithAuthor = Awaited<ReturnType<typeof getArticlesForModeration>>[number];
type CommentWithDetails = Awaited<ReturnType<typeof getCommentsForModeration>>[number];

function getArticlesForModeration() {
  return prisma.article.findMany({
    where: {
      status: {
        in: ["hidden", "archived"]
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      author: true
    }
  });
}

function getCommentsForModeration() {
  return prisma.comment.findMany({
    where: {
      status: {
        in: ["hidden", "archived"]
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 50,
    include: {
      user: true,
      article: {
        select: {
          title: true
        }
      }
    }
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function mapArticle(article: ArticleWithAuthor): AdminModerationQueueItem {
  return {
    id: article.id,
    type: "article",
    title: article.title,
    body: article.body,
    authorName: article.author.displayName ?? "LINE user",
    authorLineId: article.author.lineUserId,
    status: article.status,
    createdAt: formatDate(article.createdAt)
  };
}

function mapComment(comment: CommentWithDetails): AdminModerationQueueItem {
  return {
    id: comment.id,
    type: "comment",
    title: comment.article.title,
    body: comment.body,
    authorName: comment.user.displayName ?? "LINE user",
    authorLineId: comment.user.lineUserId,
    status: comment.status,
    createdAt: formatDate(comment.createdAt)
  };
}

export async function getAdminModerationQueue(): Promise<AdminModerationData> {
  noStore();

  try {
    const [articles, comments] = await Promise.all([getArticlesForModeration(), getCommentsForModeration()]);
    const items = [...articles.map(mapArticle), ...comments.map(mapComment)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      items,
      summary: {
        hiddenArticles: articles.filter((article) => article.status === "hidden").length,
        hiddenComments: comments.filter((comment) => comment.status === "hidden").length,
        archived: articles.filter((article) => article.status === "archived").length + comments.filter((comment) => comment.status === "archived").length
      }
    };
  } catch {
    return {
      items: [],
      summary: {
        hiddenArticles: 0,
        hiddenComments: 0,
        archived: 0
      },
      unavailable: true
    };
  }
}
