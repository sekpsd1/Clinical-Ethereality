import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  userUpdate: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminSession: mocks.requireAdminSession
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

import { updateUserStatusAction } from "@/features/admin/users/actions";

describe("admin user status action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        user: {
          update: mocks.userUpdate
        }
      })
    );
    mocks.userUpdate.mockResolvedValue({});
  });

  it("reactivates a suspended staff account and records the status change", async () => {
    const formData = new FormData();
    formData.set("userId", "doctor-1");
    formData.set("status", "active");

    await expect(updateUserStatusAction({ status: "idle", message: "" }, formData)).resolves.toEqual({
      status: "success",
      message: "เปิดใช้งานบัญชีอีกครั้งเรียบร้อยแล้ว"
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "doctor-1" },
      data: { status: "active" }
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "admin-1",
        action: "user.update_status",
        entityType: "user",
        entityId: "doctor-1",
        metadata: { status: "active" }
      })
    );
  });

  it("does not let the current admin reactivate their own account", async () => {
    const formData = new FormData();
    formData.set("userId", "admin-1");
    formData.set("status", "active");

    await expect(updateUserStatusAction({ status: "idle", message: "" }, formData)).resolves.toEqual({
      status: "error",
      message: "ผู้ดูแลไม่สามารถระงับหรือเก็บถาวรบัญชีของตนเองจากขั้นตอนนี้ได้"
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
