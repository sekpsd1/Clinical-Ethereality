import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  cleanup: vi.fn(),
  deleteUser: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/guards", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/admin/users/delete-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/users/delete-service")
  >("@/features/admin/users/delete-service");

  return {
    ...actual,
    cleanupDeletedUserFiles: mocks.cleanup,
    deleteUserPermanently: mocks.deleteUser
  };
});

import { deleteUserPermanentlyAction } from "@/features/admin/users/actions";

const idle = { status: "idle" as const, message: "" };

function formData(userId = "customer-1") {
  const data = new FormData();
  data.set("userId", userId);
  return data;
}

describe("Admin permanent user deletion action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({}));
    mocks.deleteUser.mockResolvedValue({ removedUserId: "customer-1", files: [] });
  });

  it("requires the dedicated delete permission before mutation", async () => {
    mocks.assertPermission.mockImplementationOnce(() => {
      throw new Error("permission denied");
    });

    await expect(deleteUserPermanentlyAction(idle, formData())).rejects.toThrow("permission denied");
    expect(mocks.assertPermission).toHaveBeenCalledWith(
      { userId: "admin-1", role: "admin" },
      "user:delete"
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires another Admin to delete the currently signed-in account", async () => {
    const result = await deleteUserPermanentlyAction(idle, formData("admin-1"));

    expect(result.status).toBe("error");
    expect(result.message).toContain("ผู้ดูแลระบบอีกบัญชี");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("deletes in one serializable transaction, removes files, and refreshes Admin lists", async () => {
    const result = await deleteUserPermanentlyAction(idle, formData());

    expect(result.status).toBe("success");
    expect(mocks.deleteUser).toHaveBeenCalledWith(expect.anything(), {
      actorId: "admin-1",
      userId: "customer-1"
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.cleanup).toHaveBeenCalledWith([]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/customers");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/audit");
  });
});
