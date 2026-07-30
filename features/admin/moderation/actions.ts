"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { updateModerationItemSchema } from "@/features/admin/moderation/schema";
import { getModerationNextStatus, getReportResolutionStatus } from "@/features/admin/moderation/rules";

export type AdminModerationActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  const values = Object.fromEntries(formData.entries());

  if (!values.reportId) {
    delete values.reportId;
  }

  return values;
}

export async function updateModerationItemAction(
  _previousState: AdminModerationActionState,
  formData: FormData
): Promise<AdminModerationActionState> {
  const session = await requireAdminSession();
  const parsed = updateModerationItemSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอดูแลเนื้อหาไม่ถูกต้อง"
    };
  }

  const { action, itemId, itemType, reportId } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const report = reportId
        ? await tx.communityReport.findFirst({
            where: {
              id: reportId,
              status: "pending",
              ...(itemType === "article"
                ? {
                    articleId: itemId
                  }
                : {
                    commentId: itemId
                  })
            },
            select: {
              id: true,
              reporterId: true,
              reason: true
            }
          })
        : null;

      if (reportId && !report) {
        throw new Error("Moderation report is no longer pending.");
      }

      let ownerId = "";
      let articleSlug = "";
      let title = "";
      let previousStatus = "";
      let nextStatus = "";

      if (itemType === "article") {
        const item = await tx.article.findUnique({
          where: {
            id: itemId
          },
          select: {
            authorId: true,
            slug: true,
            title: true,
            status: true,
            publishedAt: true
          }
        });

        if (!item) {
          throw new Error("Article not found.");
        }

        ownerId = item.authorId;
        articleSlug = item.slug;
        title = item.title;
        previousStatus = item.status;
        nextStatus = getModerationNextStatus("article", action);

        await tx.article.update({
          where: {
            id: itemId
          },
          data: {
            status: nextStatus as "published" | "hidden" | "archived",
            publishedAt: action === "restore" && !item.publishedAt ? new Date() : undefined
          }
        });
      } else {
        const item = await tx.comment.findUnique({
          where: {
            id: itemId
          },
          select: {
            userId: true,
            status: true,
            article: {
              select: {
                slug: true,
                title: true
              }
            }
          }
        });

        if (!item) {
          throw new Error("Comment not found.");
        }

        ownerId = item.userId;
        articleSlug = item.article.slug;
        title = item.article.title;
        previousStatus = item.status;
        nextStatus = getModerationNextStatus("comment", action);

        await tx.comment.update({
          where: {
            id: itemId
          },
          data: {
            status: nextStatus as "visible" | "hidden" | "archived"
          }
        });
      }

      if (report) {
        await tx.communityReport.update({
          where: {
            id: report.id
          },
          data: {
            reviewerId: session.userId,
            status: getReportResolutionStatus(action),
            resolutionAction: action,
            reviewedAt: new Date()
          }
        });

        await tx.notification.create({
          data: {
            userId: report.reporterId,
            type: "community",
            channel: "in_app",
            title: "ตรวจสอบรายงานชุมชนแล้ว",
            body:
              action === "restore"
                ? "ผู้ดูแลตรวจแล้วและคงเนื้อหาไว้"
                : action === "hide"
                  ? "ผู้ดูแลซ่อนเนื้อหาตามรายงานแล้ว"
                  : "ผู้ดูแลเก็บเนื้อหาถาวรตามรายงานแล้ว",
            metadataJson: {
              reportId: report.id,
              href: action === "restore" ? `/community/${articleSlug}` : "/community"
            }
          }
        });
      }

      if (ownerId && ownerId !== session.userId) {
        await tx.notification.create({
          data: {
            userId: ownerId,
            type: "community",
            channel: "in_app",
            title: "ผลการดูแลเนื้อหาชุมชน",
            body:
              action === "restore"
                ? `ผู้ดูแลตรวจแล้วและคงเนื้อหา “${title}” ไว้`
                : action === "hide"
                  ? `เนื้อหา “${title}” ถูกซ่อนหลังการตรวจสอบ`
                  : `เนื้อหา “${title}” ถูกเก็บถาวรหลังการตรวจสอบ`,
            metadataJson: {
              href: action === "restore" ? `/community/${articleSlug}` : "/community"
            }
          }
        });
      }

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: `moderation.${action}`,
        entityType: itemType,
        entityId: itemId,
        metadata: {
          reportId: report?.id ?? null,
          reportReason: report?.reason ?? null,
          previousStatus,
          nextStatus
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "ยังอัปเดตเนื้อหาไม่ได้ รายการอาจถูกตรวจไปแล้ว กรุณาลองรีเฟรช"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/notifications");
  revalidatePath("/community");
  revalidatePath("/community/search");
  revalidatePath("/notifications");

  return {
    status: "success",
    message: action === "restore" ? "ตรวจแล้วและคงเนื้อหาไว้" : action === "hide" ? "ซ่อนเนื้อหาแล้ว" : "เก็บถาวรเนื้อหาแล้ว"
  };
}
