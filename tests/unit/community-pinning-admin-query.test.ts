import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ articleFindMany: vi.fn() }));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { article: { findMany: mocks.articleFindMany } } }));

import { getAdminPinnedPostsData } from "@/features/community/pinning/queries";

describe("Admin pinned posts query", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads at most three current pins newest-first and keeps candidate search limited to published articles", async () => {
    const record = {
      id: "article-1",
      slug: "article-1",
      title: "Article",
      category: "ดูแลผิว",
      pinnedAt: new Date("2026-09-14T05:00:00.000Z"),
      author: { displayName: "Author" }
    };
    mocks.articleFindMany.mockResolvedValueOnce([record]).mockResolvedValueOnce([record]);

    const result = await getAdminPinnedPostsData();

    expect(mocks.articleFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { status: "published", pinnedAt: { not: null } },
      orderBy: [{ pinnedAt: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: 3
    }));
    expect(mocks.articleFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100
    }));
    expect(result.pinnedPosts[0]).toMatchObject({ id: "article-1", pinned: true });
    expect(result.maximumPins).toBe(3);
  });
});
