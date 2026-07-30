"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { awardRewardPoints, getRewardExpiryDate, rewardRules } from "@/features/rewards/rules";
import { articleIdSchema, commentSchema, reportContentSchema } from "@/features/community/article/schema";

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function notifyAdmins({
  tx,
  title,
  body,
  metadataJson
}: {
  tx: Prisma.TransactionClient;
  title: string;
  body: string;
  metadataJson: Record<string, string>;
}) {
  const admins = await tx.user.findMany({
    where: {
      role: "admin",
      status: "active"
    },
    select: {
      id: true
    }
  });

  if (admins.length === 0) {
    return;
  }

  await tx.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "community",
      channel: "in_app",
      title,
      body,
      metadataJson
    }))
  });
}

async function notifyContentOwner({
  tx,
  ownerId,
  actorId,
  title,
  body,
  href
}: {
  tx: Prisma.TransactionClient;
  ownerId: string;
  actorId: string;
  title: string;
  body: string;
  href: string;
}) {
  if (ownerId === actorId) {
    return;
  }

  await tx.notification.create({
    data: {
      userId: ownerId,
      type: "community",
      channel: "in_app",
      title,
      body,
      metadataJson: {
        href
      }
    }
  });
}

export async function toggleArticleLikeAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = articleIdSchema.safeParse(formData.get("articleId"));

  if (!parsed.success) {
    return;
  }

  let articleSlug = "";

  await prisma.$transaction(async (tx) => {
    const article = await tx.article.findFirst({
      where: {
        id: parsed.data,
        status: "published"
      },
      select: {
        id: true,
        slug: true,
        title: true,
        authorId: true
      }
  });

    if (!article) {
      return;
    }

    articleSlug = article.slug;
    const existingLike = await tx.like.findUnique({
      where: {
        userId_articleId: {
          userId: session.userId,
          articleId: article.id
        }
      },
      select: {
        id: true
      }
    });

    if (existingLike) {
      await tx.like.delete({
        where: {
          id: existingLike.id
        }
      });
      return;
    }

    await tx.like.create({
      data: {
        userId: session.userId,
        articleId: article.id
      }
    });

    await notifyContentOwner({
      tx,
      ownerId: article.authorId,
      actorId: session.userId,
      title: "มีคนถูกใจโพสต์ของคุณ",
      body: article.title,
      href: `/community/${article.slug}`
    });
  });

  revalidatePath("/community");
  revalidatePath("/community/search");
  if (articleSlug) {
    revalidatePath(`/community/${articleSlug}`);
  }
}

export async function toggleSavedArticleAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = articleIdSchema.safeParse(formData.get("articleId"));

  if (!parsed.success) {
    return;
  }

  let articleSlug = "";

  await prisma.$transaction(async (tx) => {
    const article = await tx.article.findFirst({
      where: {
        id: parsed.data,
        status: "published"
      },
      select: {
        id: true,
        slug: true
      }
    });

    if (!article) {
      return;
    }

    articleSlug = article.slug;
    const saved = await tx.savedArticle.findUnique({
      where: {
        userId_articleId: {
          userId: session.userId,
          articleId: article.id
        }
      },
      select: {
        id: true
      }
    });

    if (saved) {
      await tx.savedArticle.delete({
        where: {
          id: saved.id
        }
      });
    } else {
      await tx.savedArticle.create({
        data: {
          userId: session.userId,
          articleId: article.id
        }
      });
    }
  });

  revalidatePath("/community");
  revalidatePath("/community/search");
  revalidatePath("/profile/saved-articles");
  if (articleSlug) {
    revalidatePath(`/community/${articleSlug}`);
  }
}

export async function createArticleCommentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = commentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return;
  }

  let articleSlug = "";
  let rateLimited = false;

  await prisma.$transaction(async (tx) => {
    const article = await tx.article.findFirst({
      where: {
        id: parsed.data.articleId,
        status: "published"
      },
      select: {
        id: true,
        slug: true,
        title: true,
        authorId: true
      }
    });

    if (!article) {
      return;
    }

    articleSlug = article.slug;
    const recentCommentCount = await tx.comment.count({
      where: {
        userId: session.userId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000)
        }
      }
    });

    if (recentCommentCount >= 3) {
      rateLimited = true;
      return;
    }

    const comment = await tx.comment.create({
      data: {
        articleId: article.id,
        userId: session.userId,
        body: parsed.data.body,
        status: "visible"
      },
      select: {
        id: true
      }
    });

    await awardRewardPoints(tx, {
      userId: session.userId,
      sourceType: "community",
      sourceId: `article:${article.id}`,
      points: rewardRules.communityComment.points,
      expiresAt: getRewardExpiryDate()
    });

    await notifyContentOwner({
      tx,
      ownerId: article.authorId,
      actorId: session.userId,
      title: "มีความคิดเห็นใหม่ในโพสต์ของคุณ",
      body: parsed.data.body.slice(0, 140),
      href: `/community/${article.slug}`
    });

    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "community.comment.create",
      entityType: "comment",
      entityId: comment.id,
      metadata: {
        articleId: article.id
      }
    });
  });

  revalidatePath("/community");
  revalidatePath("/community/search");
  revalidatePath("/profile");
  revalidatePath("/profile/rewards");

  if (articleSlug) {
    revalidatePath(`/community/${articleSlug}`);
  }

  if (rateLimited && articleSlug) {
    redirect(`/community/${articleSlug}?comment=rate-limited`);
  }
}

export async function reportContentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = reportContentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return;
  }

  const { articleSlug, details, itemId, itemType, reason } = parsed.data;
  let outcome: "success" | "duplicate" | "self" | "unavailable" = "unavailable";

  try {
    await prisma.$transaction(async (tx) => {
      let target: {
      articleId: string;
      articleTitle: string;
      id: string;
      ownerId: string;
    } | null = null;

    if (itemType === "article") {
      const article = await tx.article.findFirst({
        where: {
          id: itemId,
          slug: articleSlug,
          status: "published"
        },
        select: {
          id: true,
          authorId: true,
          title: true
        }
      });

      if (article) {
        target = {
          articleId: article.id,
          articleTitle: article.title,
          id: article.id,
          ownerId: article.authorId
        };
      }
    } else {
      const comment = await tx.comment.findFirst({
        where: {
          id: itemId,
          status: "visible",
          article: {
            slug: articleSlug,
            status: "published"
          }
        },
        select: {
          id: true,
          userId: true,
          article: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      if (comment) {
        target = {
          articleId: comment.article.id,
          articleTitle: comment.article.title,
          id: comment.id,
          ownerId: comment.userId
        };
      }
    }

    if (!target) {
      return;
    }

    if (target.ownerId === session.userId) {
      outcome = "self";
      return;
    }

    const existing = await tx.communityReport.findFirst({
      where: {
        reporterId: session.userId,
        ...(itemType === "article"
          ? {
              articleId: target.id
            }
          : {
              commentId: target.id
            })
      },
      select: {
        id: true
      }
    });

    if (existing) {
      outcome = "duplicate";
      return;
    }

    const report = await tx.communityReport.create({
      data: {
        reporterId: session.userId,
        articleId: itemType === "article" ? target.id : null,
        commentId: itemType === "comment" ? target.id : null,
        reason,
        details: details || null,
        status: "pending"
      },
      select: {
        id: true
      }
    });

    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "community.report.create",
      entityType: itemType,
      entityId: target.id,
      metadata: {
        reportId: report.id,
        articleId: target.articleId,
        reason
      }
    });

    await notifyAdmins({
      tx,
      title: "มีรายงานเนื้อหาใหม่",
      body: `${target.articleTitle} รอการตรวจสอบ โดยเนื้อหายังไม่ถูกซ่อนอัตโนมัติ`,
      metadataJson: {
        reportId: report.id,
        articleId: target.articleId,
        reason,
        href: "/admin/moderation"
      }
    });

      outcome = "success";
    });
  } catch (error) {
    outcome =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
        ? "duplicate"
        : "unavailable";
  }

  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/notifications");
  redirect(`/community/${articleSlug}?reported=${outcome}`);
}

export async function reportArticleAction(formData: FormData): Promise<void> {
  return reportContentAction(formData);
}

export async function reportCommentAction(formData: FormData): Promise<void> {
  return reportContentAction(formData);
}
