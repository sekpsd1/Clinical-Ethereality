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
      expect.objectContaining({ data: expect.objectContaining({ status: "hidden" }) })
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
  });
});
