"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { awardRewardPoints, getRewardExpiryDate, rewardRules } from "@/features/rewards/rules";

const articleIdSchema = z.string().min(1);

const commentSchema = z.object({
  articleId: z.string().min(1),
  body: z.string().trim().min(1).max(800)
});

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
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
