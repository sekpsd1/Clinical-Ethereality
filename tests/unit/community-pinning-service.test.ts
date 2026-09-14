import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { prisma as prismaClient } from "@/lib/db/prisma";
import {
  ArticlePinError,
  maximumPinnedArticles,
  updateArticlePinState
} from "@/features/community/pinning/service";

type FakeArticle = {
  id: string;
  authorId: string;
  slug: string;
  status: "draft" | "published" | "hidden" | "archived";
  pinnedAt: Date | null;
  pinnedById: string | null;
};

function createArticle(id: string, overrides: Partial<FakeArticle> = {}): FakeArticle {
  return {
    id,
    authorId: `owner-${id}`,
    slug: `post-${id}`,
    status: "published",
    pinnedAt: null,
    pinnedById: null,
    ...overrides
  };
}

function createFakeClient(input: {
  articles: FakeArticle[];
  actor?: { id: string; role: string; status: string } | null;
}) {
  const articles = new Map(input.articles.map((article) => [article.id, article]));
  const audits: unknown[] = [];
  const notifications: unknown[] = [];
  const isolationLevels: unknown[] = [];
  let queue = Promise.resolve();

  const client = {
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>, options?: { isolationLevel?: unknown }) => {
      isolationLevels.push(options?.isolationLevel);
      const run = queue.then(async () => {
        let rawQueryCount = 0;
        const tx = {
          $queryRaw: vi.fn(async () => {
            rawQueryCount += 1;
            if (rawQueryCount === 1) return input.actor === null ? [] : [input.actor ?? { id: "admin-1", role: "admin", status: "active" }];
            return Array.from(articles.values())
              .filter((article) => article.status === "published" && article.pinnedAt)
              .sort((left, right) => (right.pinnedAt?.getTime() ?? 0) - (left.pinnedAt?.getTime() ?? 0))
              .map(({ id }) => ({ id }));
          }),
          article: {
            findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
              const article = articles.get(where.id);
              return article ? { ...article } : null;
            }),
            updateMany: vi.fn(async ({ where, data }: {
              where: { id: string; status?: string; pinnedAt?: null | { not: null } };
              data: { pinnedAt: Date | null; pinnedById: string | null };
            }) => {
              const article = articles.get(where.id);
              if (!article) return { count: 0 };
              if (where.status && article.status !== where.status) return { count: 0 };
              if (where.pinnedAt === null && article.pinnedAt !== null) return { count: 0 };
              if (where.pinnedAt !== null && typeof where.pinnedAt === "object" && article.pinnedAt === null) return { count: 0 };
              Object.assign(article, data);
              return { count: 1 };
            })
          },
          auditLog: {
            create: vi.fn(async ({ data }: { data: unknown }) => {
              audits.push(data);
              return data;
            })
          },
          notification: {
            create: vi.fn(async ({ data }: { data: unknown }) => {
              notifications.push(data);
              return data;
            })
          }
        };
        return callback(tx);
      });
      queue = run.then(() => undefined, () => undefined);
      return run;
    })
  } as unknown as typeof prismaClient;

  return { articles, audits, notifications, isolationLevels, client };
}

describe("community article pinning service", () => {
  it("pins a published article, records minimized audit metadata, and notifies a different owner once", async () => {
    const now = new Date("2026-09-14T05:00:00.000Z");
    const fake = createFakeClient({ articles: [createArticle("article-1")] });

    const result = await updateArticlePinState(
      { actorId: "admin-1", articleId: "article-1", action: "pin", now },
      fake.client
    );

    expect(result).toEqual({ action: "pin", changed: true, pinned: true });
    expect(fake.articles.get("article-1")).toMatchObject({ pinnedAt: now, pinnedById: "admin-1" });
    expect(fake.audits).toEqual([
      expect.objectContaining({
        actorId: "admin-1",
        action: "community.article.pin",
        entityType: "article",
        entityId: "article-1",
        metadataJson: {
          previousPinned: false,
          nextPinned: true,
          changedAt: now.toISOString()
        }
      })
    ]);
    expect(JSON.stringify(fake.audits)).not.toContain("title");
    expect(JSON.stringify(fake.audits)).not.toContain("body");
    expect(fake.notifications).toHaveLength(1);
  });

  it("keeps duplicate pin and unpin requests idempotent without duplicate audit or notification", async () => {
    const fake = createFakeClient({
      articles: [
        createArticle("pinned", { pinnedAt: new Date("2026-09-14T04:00:00.000Z"), pinnedById: "admin-1" }),
        createArticle("plain")
      ]
    });

    await expect(updateArticlePinState({ actorId: "admin-1", articleId: "pinned", action: "pin" }, fake.client))
      .resolves.toEqual({ action: "pin", changed: false, pinned: true });
    await expect(updateArticlePinState({ actorId: "admin-1", articleId: "plain", action: "unpin" }, fake.client))
      .resolves.toEqual({ action: "unpin", changed: false, pinned: false });

    expect(fake.audits).toHaveLength(0);
    expect(fake.notifications).toHaveLength(0);
  });

  it("rejects missing, unpublished, inactive, and non-admin actors", async () => {
    for (const status of ["draft", "hidden", "archived"] as const) {
      const unpublished = createFakeClient({ articles: [createArticle(status, { status })] });
      await expect(updateArticlePinState({ actorId: "admin-1", articleId: status, action: "pin" }, unpublished.client))
        .rejects.toMatchObject({ code: "not_published" });
    }

    const missing = createFakeClient({ articles: [] });
    await expect(updateArticlePinState({ actorId: "admin-1", articleId: "missing", action: "pin" }, missing.client))
      .rejects.toMatchObject({ code: "not_found" });

    for (const actor of [
      { id: "admin-1", role: "admin", status: "inactive" },
      { id: "customer-1", role: "customer", status: "active" }
    ]) {
      const denied = createFakeClient({ articles: [createArticle("article-1")], actor });
      await expect(updateArticlePinState({ actorId: actor.id, articleId: "article-1", action: "pin" }, denied.client))
        .rejects.toMatchObject({ code: "unauthorized" });
    }
  });

  it("unpins with audit only and does not notify the owner", async () => {
    const fake = createFakeClient({
      articles: [createArticle("article-1", { pinnedAt: new Date(), pinnedById: "admin-1" })]
    });

    await updateArticlePinState({ actorId: "admin-1", articleId: "article-1", action: "unpin" }, fake.client);

    expect(fake.articles.get("article-1")).toMatchObject({ pinnedAt: null, pinnedById: null });
    expect(fake.audits).toHaveLength(1);
    expect(fake.audits[0]).toMatchObject({ action: "community.article.unpin" });
    expect(fake.notifications).toHaveLength(0);
  });

  it("does not notify when the active Admin owns the article being pinned", async () => {
    const fake = createFakeClient({
      articles: [createArticle("article-1", { authorId: "admin-1" })]
    });

    await updateArticlePinState({ actorId: "admin-1", articleId: "article-1", action: "pin" }, fake.client);

    expect(fake.audits).toHaveLength(1);
    expect(fake.notifications).toHaveLength(0);
  });

  it("serializes concurrent pins so two requests starting at two pins can never exceed three", async () => {
    const fake = createFakeClient({
      articles: [
        createArticle("pin-1", { pinnedAt: new Date("2026-09-14T01:00:00.000Z") }),
        createArticle("pin-2", { pinnedAt: new Date("2026-09-14T02:00:00.000Z") }),
        createArticle("candidate-1"),
        createArticle("candidate-2")
      ]
    });

    const results = await Promise.allSettled([
      updateArticlePinState({ actorId: "admin-1", articleId: "candidate-1", action: "pin" }, fake.client),
      updateArticlePinState({ actorId: "admin-1", articleId: "candidate-2", action: "pin" }, fake.client)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejection?.reason).toBeInstanceOf(ArticlePinError);
    expect(rejection?.reason).toMatchObject({ code: "limit_reached" });
    expect(Array.from(fake.articles.values()).filter((article) => article.pinnedAt)).toHaveLength(maximumPinnedArticles);
    expect(fake.isolationLevels).toEqual([
      Prisma.TransactionIsolationLevel.Serializable,
      Prisma.TransactionIsolationLevel.Serializable
    ]);
  });
});
