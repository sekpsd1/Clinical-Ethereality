import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  articleFindMany: vi.fn(),
  savedFindMany: vi.fn(),
  userFindFirst: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    article: { findMany: mocks.articleFindMany },
    savedArticle: { findMany: mocks.savedFindMany },
    user: { findFirst: mocks.userFindFirst }
  }
}));

import {
  communityFeedArticleOrder,
  getCommunityHub,
  getSavedCommunityArticles,
  searchCommunityArticles,
  standardCommunityArticleOrder
} from "@/features/community/queries";

const customerSession = {
  userId: "customer-1",
  lineUserId: "line-customer-1",
  role: "customer" as const,
  expiresAt: "2030-01-01T00:00:00.000Z"
};

const adminSession = {
  ...customerSession,
  userId: "admin-1",
  role: "admin" as const
};

function article(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    authorId: "customer-2",
    slug: id,
    title: `Title ${id}`,
    body: "Article body",
    category: "ดูแลผิว",
    coverImageUrl: null,
    status: "published",
    publishedAt: new Date("2026-09-14T02:00:00.000Z"),
    pinnedAt: null,
    createdAt: new Date("2026-09-14T01:00:00.000Z"),
    updatedAt: new Date("2026-09-14T01:00:00.000Z"),
    pinnedById: null,
    author: { id: "customer-2", displayName: "Owner", role: "customer" },
    likes: [],
    comments: [],
    savedBy: [],
    ...overrides
  };
}

describe("community pin-aware queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindFirst.mockResolvedValue({ id: "admin-1" });
  });

  it("orders only the hub feed by latest pin and keeps category filtering and Featured selection unchanged", async () => {
    const pinnedCustomer = article("old-pinned", { pinnedAt: new Date("2026-09-14T05:00:00.000Z") });
    const latestVerified = article("latest-verified", {
      author: { id: "doctor-1", displayName: "Doctor", role: "doctor" },
      publishedAt: new Date("2026-09-14T06:00:00.000Z")
    });
    mocks.articleFindMany
      .mockResolvedValueOnce([pinnedCustomer, latestVerified])
      .mockResolvedValueOnce([latestVerified, pinnedCustomer]);

    const result = await getCommunityHub(adminSession, "ดูแลผิว");

    expect(mocks.articleFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ status: "published", category: "ดูแลผิว" }),
      orderBy: communityFeedArticleOrder
    }));
    expect(mocks.articleFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ status: "published", category: "ดูแลผิว" }),
      orderBy: standardCommunityArticleOrder
    }));
    expect(result.posts.map((post) => post.id)).toEqual(["old-pinned", "latest-verified"]);
    expect(result.posts[0]?.pinned).toBe(true);
    expect(result.featured?.id).toBe("latest-verified");
    expect(result.canManagePins).toBe(true);
  });

  it("keeps Search and Saved Articles on their original ordering and selection paths", async () => {
    mocks.articleFindMany.mockResolvedValueOnce([article("search-result", { pinnedAt: new Date() })]);
    const search = await searchCommunityArticles(customerSession, { query: "skin", category: "ดูแลผิว" });
    expect(mocks.articleFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: standardCommunityArticleOrder }));
    expect(search.results[0]?.pinned).toBe(true);
    expect(search.canManagePins).toBe(false);
    expect(mocks.userFindFirst).not.toHaveBeenCalled();

    const savedRecord = article("saved-result", { pinnedAt: new Date() });
    mocks.savedFindMany.mockResolvedValueOnce([{ article: savedRecord, createdAt: new Date() }]);
    const saved = await getSavedCommunityArticles(customerSession);
    expect(mocks.savedFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "desc" } }));
    expect(saved.articles[0]?.pinned).toBe(true);
  });

  it("hides pin controls when the database no longer confirms an active Admin account", async () => {
    mocks.articleFindMany.mockResolvedValue([]);
    mocks.userFindFirst.mockResolvedValue(null);

    await expect(searchCommunityArticles(adminSession, {})).resolves.toMatchObject({ canManagePins: false });
    expect(mocks.userFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "admin-1", role: "admin", status: "active" }
    }));
  });
});
