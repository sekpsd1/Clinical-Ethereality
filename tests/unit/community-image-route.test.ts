import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  articleFindUnique: vi.fn(),
  attachmentFindUnique: vi.fn(),
  getCurrentSession: vi.fn(),
  readCommunityImage: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    fileAttachment: {
      findUnique: mocks.attachmentFindUnique
    },
    article: {
      findUnique: mocks.articleFindUnique
    }
  }
}));

vi.mock("@/features/community/images/service", () => ({
  communityImageEntityType: "community_article_image",
  readCommunityImage: mocks.readCommunityImage
}));

import { GET } from "@/app/api/community/images/[attachmentId]/route";

describe("community image route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated image reads before querying attachments", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/community/images/image-1"), {
      params: Promise.resolve({ attachmentId: "image-1" })
    });

    expect(response.status).toBe(401);
    expect(mocks.attachmentFindUnique).not.toHaveBeenCalled();
  });

  it("serves a published attachment only to an authenticated Community user", async () => {
    mocks.getCurrentSession.mockResolvedValue({ userId: "viewer-1", role: "customer" });
    mocks.attachmentFindUnique.mockResolvedValue({
      entityId: "article-1",
      entityType: "community_article_image",
      ownerId: "author-1",
      status: "attached",
      storageKey: "community/author/article/image.webp",
      mimeType: "image/webp"
    });
    mocks.articleFindUnique.mockResolvedValue({ authorId: "author-1", status: "published" });
    mocks.readCommunityImage.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const response = await GET(new Request("http://localhost/api/community/images/image-1"), {
      params: Promise.resolve({ attachmentId: "image-1" })
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
