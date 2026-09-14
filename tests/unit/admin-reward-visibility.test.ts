import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCount: vi.fn(),
  auditFindMany: vi.fn(),
  auditGroupBy: vi.fn(),
  notificationFindMany: vi.fn(),
  userFindMany: vi.fn()
}));

vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    auditLog: {
      count: mocks.auditCount,
      findMany: mocks.auditFindMany,
      groupBy: mocks.auditGroupBy
    },
    notification: { findMany: mocks.notificationFindMany },
    user: { findMany: mocks.userFindMany }
  }
}));

import { getAdminAuditLogs } from "@/features/admin/audit/queries";
import { getAdminNotifications } from "@/features/admin/notifications/queries";

beforeEach(() => {
  vi.stubEnv("ENABLE_REWARD_POINTS", "false");
  mocks.auditCount.mockResolvedValue(0);
  mocks.auditFindMany.mockResolvedValue([]);
  mocks.auditGroupBy.mockResolvedValue([]);
  mocks.notificationFindMany.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Admin reward visibility", () => {
  it("excludes legacy reward notifications from the active Admin list", async () => {
    await expect(getAdminNotifications()).resolves.toMatchObject({
      notifications: [],
      summary: { totalRecent: 0 }
    });

    expect(mocks.notificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: { not: "reward" } } })
    );
  });

  it("excludes reward-only audit records from Admin counts and pages", async () => {
    await expect(getAdminAuditLogs()).resolves.toMatchObject({
      logs: [],
      summary: { total: 0 }
    });

    const expectedWhere = {
      NOT: [
        { action: { startsWith: "reward." } },
        { entityType: "reward_point" }
      ]
    };
    expect(mocks.auditCount).toHaveBeenCalledWith({ where: expectedWhere });
    expect(mocks.auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    );
    expect(mocks.auditGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere })
    );
  });
});
