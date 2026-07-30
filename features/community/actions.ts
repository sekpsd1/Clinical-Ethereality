"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentSession } from "@/lib/auth/session";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { communityPostSchema, updateCommunityPostSchema } from "@/features/community/schema";

export type CommunityPostActionState = {
  status: "idle" | "error";
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function createPostSlug(title: string): string {
  const base = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return `${base || "community-post"}-${randomUUID().slice(0, 8)}`;
}

export async function createCommunityPostAction(
  _previousState: CommunityPostActionState,
  formData: FormData
): Promise<CommunityPostActionState> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = communityPostSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาตรวจข้อมูลโพสต์อีกครั้ง",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const recentPostCount = await prisma.article.count({
    where: {
      authorId: session.userId,
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000)
      }
    }
  });

  if (recentPostCount >= 3) {
    return {
      status: "error",
      message: "สร้างโพสต์ได้ไม่เกิน 3 รายการต่อชั่วโมง กรุณาลองใหม่ภายหลัง"
    };
  }

  const slug = createPostSlug(parsed.data.title);

  try {
    await prisma.$transaction(async (tx) => {
      const article = await tx.article.create({
        data: {
          authorId: session.userId,
          title: parsed.data.title,
          slug,
          category: parsed.data.category,
          body: parsed.data.body,
          status: "published",
          publishedAt: new Date()
        },
        select: {
          id: true
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "community.post.create",
        entityType: "article",
        entityId: article.id,
        metadata: {
          category: parsed.data.category,
          privacyAcknowledged: true
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "ยังสร้างโพสต์ไม่ได้ กรุณาลองอีกครั้ง"
    };
  }

  revalidatePath("/community");
  revalidatePath("/community/search");
  revalidatePath("/profile");
  redirect(`/community/${slug}`);
}

export async function updateCommunityPostAction(
  _previousState: CommunityPostActionState,
  formData: FormData
): Promise<CommunityPostActionState> {
  const session = await requireCurrentSession();
  assertPermission(session, "community:create:self");
  const parsed = updateCommunityPostSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรุณาตรวจข้อมูลโพสต์อีกครั้ง",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  let postSlug = "";

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.article.findFirst({
        where: {
          id: parsed.data.articleId,
          authorId: session.userId,
          status: {
            in: ["draft", "published"]
          }
        },
        select: {
          id: true,
          slug: true,
          title: true,
          category: true
        }
      });

      if (!current) {
        throw new Error("Community post ownership check failed.");
      }

      postSlug = current.slug;
      await tx.article.update({
        where: {
          id: current.id
        },
        data: {
          title: parsed.data.title,
          body: parsed.data.body,
          category: parsed.data.category
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "community.post.update",
        entityType: "article",
        entityId: current.id,
        metadata: {
          previousTitle: current.title,
          previousCategory: current.category,
          nextCategory: parsed.data.category,
          privacyAcknowledged: true
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "ไม่พบโพสต์ที่คุณมีสิทธิ์แก้ไข หรือยังบันทึกไม่ได้"
    };
  }

  revalidatePath("/community");
  revalidatePath("/community/search");
  if (postSlug) {
    revalidatePath(`/community/${postSlug}`);
    redirect(`/community/${postSlug}`);
  }

  return {
    status: "error",
    message: "ยังเปิดโพสต์ที่แก้ไขไม่ได้"
  };
}
