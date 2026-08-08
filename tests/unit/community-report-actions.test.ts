import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  articleUpdate: vi.fn(),
  assertPermission: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireCurrentSession: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: mocks.assertPermission
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import { reportContentAction } from "@/features/community/article/actions";

const session = {
  userId: "reporter-1",
  lineUserId: "line-reporter-1",
  role: "customer" as const,
  displayName: "Reporter",
  expiresAt: "2030-01-01T00:00:00.000Z"
};

function reportForm() {
  const form = new FormData();
  form.set("itemId", "article-1");
  form.set("itemType", "article");
  form.set("articleSlug", "community-post");
  form.set("reason", "privacy");
  form.set("details", "Contains identifying information");
  return form;
}

describe("community report action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue(session);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        article: {
          findFirst: vi.fn().mockResolvedValue({
            id: "article-1",
            authorId: "author-1",
            title: "Community post"
          }),
          update: mocks.articleUpdate
        },
        communityReport: {
          create: vi.fn().mockResolvedValue({ id: "report-1" }),
          findFirst: vi.fn().mockResolvedValue(null)
        },
        notification: {
          createMany: vi.fn()
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: "admin-1" }])
        }
      })
    );
  });

  it("persists a pending report and leaves reported content published", async () => {
    await reportContentAction(reportForm());

    expect(mocks.articleUpdate).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "community.report.create", entityId: "article-1" })
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/community/community-post?reported=success");
  });

  it("blocks duplicate reports without creating a second audit or notification", async () => {
    mocks.transaction.mockImplementationOnce(async (callback) =>
      callback({
        article: {
          findFirst: vi.fn().mockResolvedValue({
            id: "article-1",
            authorId: "author-1",
            title: "Community post"
          }),
          update: mocks.articleUpdate
        },
        communityReport: {
          findFirst: vi.fn().mockResolvedValue({ id: "existing-report" }),
          create: vi.fn()
        },
        notification: { createMany: vi.fn() },
        user: { findMany: vi.fn() }
      })
    );

    await reportContentAction(reportForm());

    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/community/community-post?reported=duplicate");
  });

  it("blocks self-reports without creating a report", async () => {
    mocks.transaction.mockImplementationOnce(async (callback) =>
      callback({
        article: {
          findFirst: vi.fn().mockResolvedValue({
            id: "article-1",
            authorId: session.userId,
            title: "Community post"
          }),
          update: mocks.articleUpdate
        },
        communityReport: { findFirst: vi.fn(), create: vi.fn() },
        notification: { createMany: vi.fn() },
        user: { findMany: vi.fn() }
      })
    );

    await reportContentAction(reportForm());

    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/community/community-post?reported=self");
  });
});
