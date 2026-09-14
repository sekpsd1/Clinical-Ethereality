import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAdminSession: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminSession: mocks.requireAdminSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import { updateModerationItemAction } from "@/features/admin/moderation/actions";

describe("community moderation action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1" });
  });

  it("hides reported content and records the resolution, notifications, and audit", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      article: {
        findUnique: vi.fn().mockResolvedValue({
          authorId: "author-1",
          slug: "community-post",
          title: "Community post",
          status: "published",
          publishedAt: new Date()
        }),
        update: vi.fn()
      },
      communityReport: {
        findFirst: vi.fn().mockResolvedValue({
          id: "report-1",
          reporterId: "reporter-1",
          reason: "privacy"
        }),
        update: vi.fn()
      },
      notification: {
        create: vi.fn()
      }
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    const form = new FormData();
    form.set("itemId", "article-1");
    form.set("itemType", "article");
    form.set("reportId", "report-1");
    form.set("action", "hide");

    const result = await updateModerationItemAction({ status: "idle", message: "" }, form);

    expect(result.status).toBe("success");
    expect(tx.article.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "hidden", pinnedAt: null, pinnedById: null }) })
    );
    expect(tx.communityReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewerId: "admin-1", status: "actioned", resolutionAction: "hide" })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledTimes(2);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: "moderation.hide", entityId: "article-1" })
    );
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable"
    });
  });

  it("restores a hidden article without re-pinning it", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      article: {
        findUnique: vi.fn().mockResolvedValue({
          authorId: "author-1",
          slug: "community-post",
          title: "Community post",
          status: "hidden",
          publishedAt: new Date()
        }),
        update: vi.fn()
      },
      communityReport: { findFirst: vi.fn(), update: vi.fn() },
      notification: { create: vi.fn() }
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    const form = new FormData();
    form.set("itemId", "article-1");
    form.set("itemType", "article");
    form.set("action", "restore");

    await updateModerationItemAction({ status: "idle", message: "" }, form);

    const updateData = tx.article.update.mock.calls[0]?.[0]?.data;
    expect(updateData.status).toBe("published");
    expect(updateData.pinnedAt).toBeUndefined();
    expect(updateData.pinnedById).toBeUndefined();
  });

  it("clears pin metadata when an article is archived", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "article-1" }]),
      article: {
        findUnique: vi.fn().mockResolvedValue({
          authorId: "author-1",
          slug: "community-post",
          title: "Community post",
          status: "published",
          publishedAt: new Date()
        }),
        update: vi.fn()
      },
      communityReport: { findFirst: vi.fn(), update: vi.fn() },
      notification: { create: vi.fn() }
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    const form = new FormData();
    form.set("itemId", "article-1");
    form.set("itemType", "article");
    form.set("action", "archive");

    await updateModerationItemAction({ status: "idle", message: "" }, form);

    expect(tx.article.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "archived", pinnedAt: null, pinnedById: null })
    }));
  });
});
