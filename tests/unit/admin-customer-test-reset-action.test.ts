import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  cleanup: vi.fn(),
  preview: vi.fn(),
  reset: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/guards", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/features/admin/customers/test-reset-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/customers/test-reset-service")
  >("@/features/admin/customers/test-reset-service");

  return {
    ...actual,
    cleanupCustomerTestResetFiles: mocks.cleanup,
    previewCustomerTestReset: mocks.preview,
    resetCustomerTestAccount: mocks.reset
  };
});

import {
  previewCustomerTestResetAction,
  resetCustomerTestAccountAction
} from "@/features/admin/customers/actions";
import { CustomerTestResetError } from "@/features/admin/customers/test-reset-service";

const idle = { status: "idle" as const, message: "" };

function previewFormData() {
  const data = new FormData();
  data.set("customerId", "customer-1");
  return data;
}

function resetFormData() {
  const data = previewFormData();
  data.set("confirmedCustomerId", "customer-1");
  data.set("expectedUpdatedAt", "2026-09-12T08:00:00.000Z");
  data.set("expectedFingerprint", "a".repeat(64));
  data.set("confirmationText", "RESET LINE •••ER0001");
  return data;
}

describe("admin customer test reset actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({}));
    mocks.preview.mockResolvedValue({
      code: "eligible",
      eligible: true,
      target: {
        customerId: "customer-1",
        reference: "LINE •••ER0001",
        expectedUpdatedAt: "2026-09-12T08:00:00.000Z",
        expectedFingerprint: "a".repeat(64),
        confirmationText: "RESET LINE •••ER0001"
      },
      counts: {
        assessments: 1,
        consultations: 1,
        prescriptions: 0,
        orders: 1,
        payments: 1,
        communityRecords: 0,
        profileRecords: 0,
        files: 1,
        consents: 2,
        activeSessions: 1,
        reservedUnitsToRelease: 1,
        stockUnitsToRestore: 0
      }
    });
    mocks.reset.mockResolvedValue({
      removedUserId: "customer-1",
      files: []
    });
  });

  it("requires the dedicated permission before preview database access", async () => {
    mocks.assertPermission.mockImplementationOnce(() => {
      throw new Error("permission denied");
    });

    await expect(previewCustomerTestResetAction(idle, previewFormData())).rejects.toThrow("permission denied");
    expect(mocks.assertPermission).toHaveBeenCalledWith(
      { userId: "admin-1", role: "admin" },
      "customer:test-reset"
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns the server-side allowlist denial from preview", async () => {
    mocks.preview.mockResolvedValueOnce({ code: "not_test_account", eligible: false });

    const result = await previewCustomerTestResetAction(idle, previewFormData());

    expect(result.status).toBe("error");
    expect(result.message).toContain("allowlist");
  });

  it("rejects a mismatched exact target before opening the mutation transaction", async () => {
    const data = resetFormData();
    data.set("confirmedCustomerId", "customer-other");

    const result = await resetCustomerTestAccountAction(idle, data);

    expect(result.status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it("runs reset in a serializable transaction and revalidates customer surfaces", async () => {
    const result = await resetCustomerTestAccountAction(idle, resetFormData());

    expect(result.status).toBe("success");
    expect(mocks.reset).toHaveBeenCalledWith(expect.anything(), {
      actorId: "admin-1",
      customerId: "customer-1",
      expectedUpdatedAt: new Date("2026-09-12T08:00:00.000Z"),
      expectedFingerprint: "a".repeat(64),
      confirmationText: "RESET LINE •••ER0001"
    });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/customers");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/audit");
    expect(mocks.cleanup).toHaveBeenCalledWith([]);
  });

  it("requires a fresh preview if the account changed", async () => {
    mocks.reset.mockRejectedValueOnce(new CustomerTestResetError("STALE_PREVIEW"));

    const result = await resetCustomerTestAccountAction(idle, resetFormData());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Preview");
  });
});
