import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRoleSession: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("@/lib/auth/guards", () => ({
  requireRoleSession: mocks.requireRoleSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    notification: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      update: mocks.update
    }
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_noStore: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

import {
  markCustomerNotificationsReadAction,
  openCustomerNotificationAction
} from "@/features/notifications/actions";

describe("customer notification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRoleSession.mockResolvedValue({
      userId: "customer-1",
      lineUserId: "line-customer-1",
      role: "customer",
      expiresAt: "2030-01-01T00:00:00.000Z"
    });
  });

  it("marks only customer-visible notifications as read", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "staff-notification",
        type: "consultation",
        metadataJson: { href: "/doctor/consultations" }
      },
      {
        id: "customer-notification",
        type: "consultation",
        metadataJson: { href: "/consult/appointments/consultation-1" }
      }
    ]);

    await markCustomerNotificationsReadAction();

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["customer-notification"] },
          userId: "customer-1"
        })
      })
    );
  });

  it("does not mark or open a staff-only notification through the customer action", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "staff-notification",
      type: "consultation",
      metadataJson: { href: "/doctor/consultations" }
    });
    const formData = new FormData();
    formData.set("notificationId", "staff-notification");

    await openCustomerNotificationAction(formData);

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
