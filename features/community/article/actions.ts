"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { awardRewardPoints, getRewardExpiryDate, rewardRules } from "@/features/rewards/rules";

const articleIdSchema = z.string().min(1);

const commentSchema = z.object({
  articleId: z.string().min(1),
  body: z.string().trim().min(1).max(800)
});

const reportContentSchema = z.object({
  itemId: z.string().min(1),
  reason: z.string().trim().max(240).optional()
});

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function getReportReason(reason: string | undefined): string {
  return reason?.trim() || "Customer reported this content for moderation review.";
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

export async function toggleArticleLikeAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = articleIdSchema.safeParse(formData.get("articleId"));

  if (!parsed.success) {
    return;
  }

  const existingLike = await prisma.like.findUnique({
    where: {
      userId_articleId: {
        userId: session.userId,
        articleId: parsed.data
      }
    },
    select: {
      id: true
    }
  });

  if (existingLike) {
    await prisma.like.delete({
      where: {
        id: existingLike.id
      }
    });
  } else {
    await prisma.like.create({
      data: {
        userId: session.userId,
        articleId: parsed.data
      }
    });
  }

  revalidatePath("/community");
  revalidatePath("/community/vitamin-c-tips");
}

export async function createArticleCommentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = commentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        articleId: parsed.data.articleId,
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
      sourceId: comment.id,
      points: rewardRules.communityComment.points,
      expiresAt: getRewardExpiryDate()
    });
  });

  revalidatePath("/community");
  revalidatePath("/community/vitamin-c-tips");
  revalidatePath("/profile");
  revalidatePath("/profile/rewards");
}

export async function reportArticleAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = reportContentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return;
  }

  const reason = getReportReason(parsed.data.reason);

  await prisma.$transaction(async (tx) => {
    const article = await tx.article.update({
      where: {
        id: parsed.data.itemId
      },
      data: {
        status: "hidden"
      },
      select: {
        id: true,
        title: true
      }
    });

    await notifyAdmins({
      tx,
      title: "Community article reported",
      body: `${article.title} was reported by a customer and moved to moderation review.`,
      metadataJson: {
        articleId: article.id,
        reporterId: session.userId,
        reason,
        href: "/admin/moderation"
      }
    });
  });

  revalidatePath("/community");
  revalidatePath("/community/vitamin-c-tips");
  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/notifications");
  redirect("/community?reported=article");
}

export async function reportCommentAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = reportContentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return;
  }

  const reason = getReportReason(parsed.data.reason);

  await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.update({
      where: {
        id: parsed.data.itemId
      },
      data: {
        status: "hidden"
      },
      select: {
        id: true,
        article: {
          select: {
            title: true
          }
        }
      }
    });

    await notifyAdmins({
      tx,
      title: "Community comment reported",
      body: `A comment on ${comment.article.title} was reported and moved to moderation review.`,
      metadataJson: {
        commentId: comment.id,
        reporterId: session.userId,
        reason,
        href: "/admin/moderation"
      }
    });
  });

  revalidatePath("/community");
  revalidatePath("/community/vitamin-c-tips");
  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/notifications");
}
