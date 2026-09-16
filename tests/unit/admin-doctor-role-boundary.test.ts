import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  assertPermission: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/admin/users/staff-files", () => ({ uploadAdminStaffFile: vi.fn() }));

import {
  approveStaffRoleAction,
  updateUserRoleAction
} from "@/features/admin/users/actions";

function roleFormData() {
  const data = new FormData();
  data.set("userId", "line-user-1");
  data.set("role", "doctor");
  return data;
}

describe("direct doctor role mutation boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
  });

  it("blocks the legacy generic approval action for doctor", async () => {
    const result = await approveStaffRoleAction({ status: "idle", message: "" }, roleFormData());
    expect(result.status).toBe("error");
    expect(result.message).toContain("ฟอร์มข้อมูลแพทย์");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks the generic role selector from assigning doctor", async () => {
    const result = await updateUserRoleAction({ status: "idle", message: "" }, roleFormData());
    expect(result.status).toBe("error");
    expect(result.message).toContain("ฟอร์มข้อมูลแพทย์");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
