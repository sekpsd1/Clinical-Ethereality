import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicSession } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  findMany: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_noStore: mocks.noStore
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    notification: {
      findMany: mocks.findMany
    }
  }
}));

import { getCustomerNotifications } from "@/features/notifications/queries";

function session(role: PublicSession["role"]): PublicSession {
  return {
    userId: `${role}-1`,
    lineUserId: `line-${role}-1`,
    role,
    expiresAt: "2030-01-01T00:00:00.000Z"
  };
}

describe("customer notification access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects staff roles before reading customer notifications", async () => {
    for (const role of ["doctor", "pharmacist", "admin"] as const) {
      await expect(getCustomerNotifications(session(role))).rejects.toThrow(
        "This role is not allowed"
      );
    }

    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("reads only notifications owned by the signed-in customer", async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(getCustomerNotifications(session("customer"))).resolves.toEqual({
      notifications: [],
      unreadCount: 0
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "customer-1",
          channel: "in_app"
        }
      })
    );
  });

  it("hides historical staff notifications when the same user id is now a customer", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "doctor-notification",
        type: "consultation",
        title: "ห้อง Zoom สิ้นสุดแล้ว",
        body: "กลับไปที่คิวแพทย์",
        readAt: null,
        metadataJson: {
          consultationId: "consultation-1",
          href: "/doctor/consultations"
        },
        createdAt: new Date("2030-01-01T00:00:00.000Z")
      },
      {
        id: "customer-notification",
        type: "consultation",
        title: "การปรึกษาเสร็จสิ้นแล้ว",
        body: "แพทย์บันทึกสรุปเรียบร้อยแล้ว",
        readAt: null,
        metadataJson: {
          audienceRole: "customer",
          consultationId: "consultation-1",
          href: "/consult/appointments/consultation-1"
        },
        createdAt: new Date("2030-01-01T00:01:00.000Z")
      }
    ]);

    const data = await getCustomerNotifications(session("customer"));

    expect(data.notifications).toHaveLength(1);
    expect(data.notifications[0]).toMatchObject({
      id: "customer-notification",
      href: "/consult/appointments/consultation-1"
    });
  });
});
