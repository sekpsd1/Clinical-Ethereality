import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCommunityReportReasonLabel } from "@/features/community/policy";
import type { AdminModerationData, AdminModerationQueueItem } from "@/features/admin/moderation/types";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getPendingReports() {
  return prisma.communityReport.findMany({
    where: {
      status: "pending"
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50,
    include: {
      reporter: {
        select: {
          id: true,
          displayName: true
        }
      },
      article: {
        include: {
          author: {
            select: {
              displayName: true
            }
          }
        }
      },
      comment: {
        include: {
          user: {
            select: {
              displayName: true
            }
          },
          article: {
            select: {
              title: true
            }
          }
        }
      }
    }
  });
}

function getLegacyHiddenArticles() {
  return prisma.article.findMany({
    where: {
      status: {
        in: ["hidden", "archived"]
      },
      reports: {
        none: {
          status: "pending"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 25,
    include: {
      author: {
        select: {
          displayName: true
        }
      }
    }
  });
}

function getLegacyHiddenComments() {
  return prisma.comment.findMany({
    where: {
      status: {
        in: ["hidden", "archived"]
      },
      reports: {
        none: {
          status: "pending"
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 25,
    include: {
      user: {
        select: {
          displayName: true
        }
      },
      article: {
        select: {
          title: true
        }
      }
    }
  });
}

type PendingReport = Awaited<ReturnType<typeof getPendingReports>>[number];
type HiddenArticle = Awaited<ReturnType<typeof getLegacyHiddenArticles>>[number];
type HiddenComment = Awaited<ReturnType<typeof getLegacyHiddenComments>>[number];

function mapPendingReport(report: PendingReport): AdminModerationQueueItem | null {
  if (report.article) {
    return {
      id: report.article.id,
      reportId: report.id,
      type: "article",
      title: report.article.title,
      body: report.article.body,
      authorName: report.article.author.displayName ?? "สมาชิกชุมชน",
      status: report.article.status,
      createdAt: formatDate(report.article.createdAt),
      reporterName: report.reporter.displayName ?? `สมาชิก ${report.reporter.id.slice(-4).toUpperCase()}`,
      reportReasonCode: report.reason,
      reportReason: getCommunityReportReasonLabel(report.reason),
      reportDetails: report.details,
      reportedAt: formatDate(report.createdAt)
    };
  }

  if (report.comment) {
    return {
      id: report.comment.id,
      reportId: report.id,
      type: "comment",
      title: report.comment.article.title,
      body: report.comment.body,
      authorName: report.comment.user.displayName ?? "สมาชิกชุมชน",
      status: report.comment.status,
      createdAt: formatDate(report.comment.createdAt),
      reporterName: report.reporter.displayName ?? `สมาชิก ${report.reporter.id.slice(-4).toUpperCase()}`,
      reportReasonCode: report.reason,
      reportReason: getCommunityReportReasonLabel(report.reason),
      reportDetails: report.details,
      reportedAt: formatDate(report.createdAt)
    };
  }

  return null;
}

function mapHiddenArticle(article: HiddenArticle): AdminModerationQueueItem {
  return {
    id: article.id,
    reportId: null,
    type: "article",
    title: article.title,
    body: article.body,
    authorName: article.author.displayName ?? "สมาชิกชุมชน",
    status: article.status,
    createdAt: formatDate(article.createdAt),
    reporterName: null,
    reportReasonCode: null,
    reportReason: null,
    reportDetails: null,
    reportedAt: null
  };
}

function mapHiddenComment(comment: HiddenComment): AdminModerationQueueItem {
  return {
    id: comment.id,
    reportId: null,
    type: "comment",
    title: comment.article.title,
    body: comment.body,
    authorName: comment.user.displayName ?? "สมาชิกชุมชน",
    status: comment.status,
    createdAt: formatDate(comment.createdAt),
    reporterName: null,
    reportReasonCode: null,
    reportReason: null,
    reportDetails: null,
    reportedAt: null
  };
}

export async function getAdminModerationQueue(): Promise<AdminModerationData> {
  noStore();

  try {
    const [reports, articles, comments, pendingReports, hiddenArticles, hiddenComments] = await Promise.all([
      getPendingReports(),
      getLegacyHiddenArticles(),
      getLegacyHiddenComments(),
      prisma.communityReport.count({
        where: {
          status: "pending"
        }
      }),
      prisma.article.count({
        where: {
          status: "hidden"
        }
      }),
      prisma.comment.count({
        where: {
          status: "hidden"
        }
      })
    ]);

    return {
      items: [
        ...reports.map(mapPendingReport).filter((item): item is AdminModerationQueueItem => Boolean(item)),
        ...articles.map(mapHiddenArticle),
        ...comments.map(mapHiddenComment)
      ],
      summary: {
        pendingReports,
        hiddenArticles,
        hiddenComments
      }
    };
  } catch {
    return {
      items: [],
      summary: {
        pendingReports: 0,
        hiddenArticles: 0,
        hiddenComments: 0
      },
      unavailable: true
    };
  }
}
