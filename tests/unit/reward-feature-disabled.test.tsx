import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  }),
  requireAdminSession: vi.fn().mockResolvedValue({ userId: "admin-1", role: "admin" }),
  requireCurrentSession: vi.fn().mockResolvedValue({ userId: "customer-1", role: "customer" }),
  userFindUnique: vi.fn(),
  notificationCreate: vi.fn()
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), unstable_noStore: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/auth/session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    notification: { create: mocks.notificationCreate }
  }
}));

import ProfileRewardsPage from "@/app/(app)/profile/rewards/page";
import { AdminNotificationForm } from "@/features/admin/AdminNotificationForm";
import { createNotificationAction } from "@/features/admin/notifications/actions";
import { ProfileSettings } from "@/features/profile/ProfileSettings";
import {
  isRewardPointsEnabled,
  RewardPointsDisabledError
} from "@/features/rewards/config";
import {
  awardRewardPoints,
  reverseOrderRewardPoints,
  spendRewardPoints
} from "@/features/rewards/rules";
import { redeemWellnessCreditAction } from "@/features/rewards/actions";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("disabled reward feature", () => {
  it("defaults off and enables only for the exact server value true", () => {
    vi.stubEnv("ENABLE_REWARD_POINTS", undefined);
    expect(isRewardPointsEnabled()).toBe(false);

    vi.stubEnv("ENABLE_REWARD_POINTS", "");
    expect(isRewardPointsEnabled()).toBe(false);

    vi.stubEnv("ENABLE_REWARD_POINTS", "TRUE");
    expect(isRewardPointsEnabled()).toBe(false);

    vi.stubEnv("ENABLE_REWARD_POINTS", "true");
    expect(isRewardPointsEnabled()).toBe(true);
  });

  it("does not earn, spend, or reverse points through direct domain calls", async () => {
    vi.stubEnv("ENABLE_REWARD_POINTS", "false");
    const tx = {
      $queryRaw: vi.fn(),
      rewardPoint: {
        findFirst: vi.fn(),
        create: vi.fn()
      },
      user: {
        findUnique: vi.fn(),
        update: vi.fn()
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      awardRewardPoints(tx, {
        userId: "customer-1",
        sourceType: "order",
        sourceId: "order-1",
        points: 10
      })
    ).resolves.toBe(false);
    await expect(
      spendRewardPoints(tx, {
        userId: "customer-1",
        sourceType: "admin_adjustment",
        sourceId: "redeem-1",
        points: 50
      })
    ).rejects.toBeInstanceOf(RewardPointsDisabledError);
    await expect(
      reverseOrderRewardPoints(tx, {
        userId: "customer-1",
        orderId: "order-1"
      })
    ).resolves.toBe(0);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.rewardPoint.findFirst).not.toHaveBeenCalled();
    expect(tx.rewardPoint.create).not.toHaveBeenCalled();
    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("redirects the legacy customer route without reading reward data", async () => {
    vi.stubEnv("ENABLE_REWARD_POINTS", "false");

    await expect(ProfileRewardsPage()).rejects.toThrow("REDIRECT:/profile");
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("rejects a direct redemption Server Action while rewards are disabled", async () => {
    vi.stubEnv("ENABLE_REWARD_POINTS", "false");

    await expect(redeemWellnessCreditAction()).rejects.toBeInstanceOf(RewardPointsDisabledError);
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("hides reward copy from customer settings and the Admin notification control", () => {
    const profileHtml = renderToStaticMarkup(
      createElement(ProfileSettings, {
        consentData: { items: [], acceptedCount: 0, requiredCount: 0 },
        profileData: {
          displayName: "Customer",
          avatarUrl: null,
          email: null,
          phone: null,
          phoneVerifiedAt: null,
          memberStatus: "สมาชิก",
          adviceCount: 0,
          postCount: 0
        },
        rewardsEnabled: false,
        section: "notifications"
      })
    );
    const adminHtml = renderToStaticMarkup(
      createElement(AdminNotificationForm, {
        recipients: [],
        rewardsEnabled: false
      })
    );

    expect(profileHtml).not.toContain("คะแนนสะสม");
    expect(adminHtml).not.toContain('value="reward"');
    expect(adminHtml).not.toContain("แต้มสะสม");
  });

  it("rejects a bypassed Admin reward-notification request before database access", async () => {
    vi.stubEnv("ENABLE_REWARD_POINTS", "false");
    const formData = new FormData();
    formData.set("userId", "customer-1");
    formData.set("type", "reward");
    formData.set("title", "Legacy reward message");
    formData.set("body", "Legacy reward body");

    await expect(
      createNotificationAction({ status: "idle", message: "" }, formData)
    ).resolves.toEqual({
      status: "error",
      message: "ประเภทการแจ้งเตือนนี้ไม่พร้อมใช้งาน"
    });
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });
});
