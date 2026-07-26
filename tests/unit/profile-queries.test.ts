import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn()
  },
  consultation: {
    count: vi.fn()
  },
  article: {
    count: vi.fn()
  }
}));

vi.mock("next/cache", () => ({
  unstable_noStore: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: prismaMock
}));

import { getCustomerProfileData } from "@/features/profile/queries";

const session: PublicSession = {
  userId: "user-1",
  lineUserId: "line-user-1",
  role: "customer",
  displayName: "LINE fallback",
  pictureUrl: "https://example.com/fallback.jpg",
  expiresAt: "2026-08-01T00:00:00.000Z"
};

describe("customer profile query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns account details and real activity counts from the database", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      displayName: "Ananya Test",
      avatarUrl: "https://example.com/profile.jpg",
      email: "ananya@example.com",
      phone: "0800000000",
      status: "active"
    });
    prismaMock.consultation.count.mockResolvedValue(3);
    prismaMock.article.count.mockResolvedValue(2);

    await expect(getCustomerProfileData(session)).resolves.toEqual({
      displayName: "Ananya Test",
      avatarUrl: "https://example.com/profile.jpg",
      email: "ananya@example.com",
      phone: "0800000000",
      memberStatus: "สมาชิกที่ยืนยันแล้ว",
      adviceCount: 3,
      postCount: 2
    });
    expect(prismaMock.consultation.count).toHaveBeenCalledWith({
      where: {
        patientId: "user-1",
        status: "completed"
      }
    });
    expect(prismaMock.article.count).toHaveBeenCalledWith({
      where: {
        authorId: "user-1",
        status: "published"
      }
    });
  });

  it("falls back to the signed-in LINE profile when the database is unavailable", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("database unavailable"));
    prismaMock.consultation.count.mockResolvedValue(0);
    prismaMock.article.count.mockResolvedValue(0);

    await expect(getCustomerProfileData(session)).resolves.toEqual({
      displayName: "LINE fallback",
      avatarUrl: "https://example.com/fallback.jpg",
      email: null,
      phone: null,
      memberStatus: "สมาชิก LINE",
      adviceCount: 0,
      postCount: 0,
      unavailable: true
    });
  });
});
