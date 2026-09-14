import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/db/prisma";
import type { ArticlePinAction } from "@/features/community/pinning/schema";

export const maximumPinnedArticles = 3;

export type ArticlePinErrorCode =
  | "unauthorized"
  | "not_found"
  | "not_published"
  | "limit_reached"
  | "concurrent_update";

export class ArticlePinError extends Error {
  constructor(readonly code: ArticlePinErrorCode) {
    super(code);
    this.name = "ArticlePinError";
  }
}

type AdminActorRow = {
  id: string;
  role: string;
  status: string;
};

type PinnedArticleRow = {
  id: string;
};

export async function lockPinnedArticleRange(tx: Prisma.TransactionClient): Promise<PinnedArticleRow[]> {
  return tx.$queryRaw<PinnedArticleRow[]>(Prisma.sql`
    SELECT \`id\`
    FROM \`Article\` FORCE INDEX (\`Article_status_pin_publish_idx\`)
    WHERE \`status\` = 'published'
      AND \`pinnedAt\` IS NOT NULL
    ORDER BY \`pinnedAt\` DESC, \`publishedAt\` DESC, \`createdAt\` DESC
    FOR UPDATE
  `);
}

async function lockActiveAdmin(tx: Prisma.TransactionClient, actorId: string): Promise<void> {
  const actors = await tx.$queryRaw<AdminActorRow[]>(Prisma.sql`
    SELECT \`id\`, \`role\`, \`status\`
    FROM \`User\`
    WHERE \`id\` = ${actorId}
    FOR UPDATE
  `);

  if (actors.length !== 1 || actors[0]?.role !== "admin" || actors[0]?.status !== "active") {
    throw new ArticlePinError("unauthorized");
  }
}

export type UpdateArticlePinStateInput = {
  actorId: string;
  articleId: string;
  action: ArticlePinAction;
  now?: Date;
};

export type UpdateArticlePinStateResult = {
  action: ArticlePinAction;
  changed: boolean;
  pinned: boolean;
};

export async function updateArticlePinState(
  input: UpdateArticlePinStateInput,
  client: typeof prisma = prisma
): Promise<UpdateArticlePinStateResult> {
  return client.$transaction(
    async (tx) => {
      await lockActiveAdmin(tx, input.actorId);
      const pinnedRows = await lockPinnedArticleRange(tx);
      const article = await tx.article.findUnique({
        where: { id: input.articleId },
        select: {
          id: true,
          authorId: true,
          slug: true,
          status: true,
          pinnedAt: true
        }
      });

      if (!article) {
        throw new ArticlePinError("not_found");
      }

      if (input.action === "pin" && article.status !== "published") {
        throw new ArticlePinError("not_published");
      }

      if (input.action === "pin" && article.pinnedAt) {
        return { action: input.action, changed: false, pinned: true };
      }

      if (input.action === "unpin" && !article.pinnedAt) {
        return { action: input.action, changed: false, pinned: false };
      }

      if (input.action === "pin" && pinnedRows.length >= maximumPinnedArticles) {
        throw new ArticlePinError("limit_reached");
      }

      const changedAt = input.now ?? new Date();
      const nextPinned = input.action === "pin";
      const update = await tx.article.updateMany({
        where: {
          id: article.id,
          ...(nextPinned
            ? { status: "published", pinnedAt: null }
            : { pinnedAt: { not: null } })
        },
        data: nextPinned
          ? { pinnedAt: changedAt, pinnedById: input.actorId }
          : { pinnedAt: null, pinnedById: null }
      });

      if (update.count !== 1) {
        throw new ArticlePinError("concurrent_update");
      }

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: nextPinned ? "community.article.pin" : "community.article.unpin",
        entityType: "article",
        entityId: article.id,
        metadata: {
          previousPinned: !nextPinned,
          nextPinned,
          changedAt: changedAt.toISOString()
        }
      });

      if (nextPinned && article.authorId !== input.actorId) {
        await tx.notification.create({
          data: {
            userId: article.authorId,
            type: "community",
            channel: "in_app",
            title: "โพสต์ของคุณได้รับการปักหมุด",
            body: "ผู้ดูแลปักหมุดโพสต์ของคุณไว้ด้านบนของ Community Feed",
            metadataJson: {
              articleId: article.id,
              href: `/community/${article.slug}`
            }
          }
        });
      }

      return { action: input.action, changed: true, pinned: nextPinned };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );
}
