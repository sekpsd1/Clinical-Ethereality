import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  assertPermission: vi.fn(),
  cancel: vi.fn(),
  preview: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/guards", () => ({
  requireAdminSession: mocks.requireAdminSession
}));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { $transaction: mocks.transaction }
}));
vi.mock("@/features/admin/consultation-test-reset/service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/admin/consultation-test-reset/service")
  >("@/features/admin/consultation-test-reset/service");
  return {
    ...actual,
    cancelSelectedTestConsultation: mocks.cancel,
    previewSelectedTestConsultationReset: mocks.preview
  };
});

import {
  cancelConsultationForTestResetAction,
  previewConsultationTestResetAction
} from "@/features/admin/consultation-test-reset/actions";

const idle = { status: "idle" as const, message: "" };

function previewFormData() {
  const data = new FormData();
  data.set("consultationId", "consultation-1");
  return data;
}

function cancelFormData() {
  const data = previewFormData();
  data.set("confirmedConsultationId", "consultation-1");
  data.set("expectedStatus", "pending_payment");
  data.set("expectedUpdatedAt", "2026-09-05T09:00:00.000Z");
  data.set("reason", "test_data_reset");
  return data;
}

describe("consultation test reset actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({})
    );
    mocks.preview.mockResolvedValue({
      code: "eligible",
      eligible: true,
      target: { consultationId: "consultation-1" }
    });
    mocks.cancel.mockResolvedValue({
      outcome: "cancelled",
      consultationId: "consultation-1",
      paymentPreserved: true,
      paymentStatus: "pending_review",
      slotReleased: true
    });
  });

  it("requires the dedicated admin permission before preview database access", async () => {
    mocks.assertPermission.mockImplementationOnce(() => {
      throw new Error("permission denied");
    });

    await expect(
      previewConsultationTestResetAction(idle, previewFormData())
    ).rejects.toThrow("permission denied");
    expect(mocks.assertPermission).toHaveBeenCalledWith(
      { userId: "admin-1", role: "admin" },
      "consultation:test-reset"
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires the dedicated admin permission before cancellation database access", async () => {
    mocks.assertPermission.mockImplementationOnce(() => {
      throw new Error("permission denied");
    });

    await expect(
      cancelConsultationForTestResetAction(idle, cancelFormData())
    ).rejects.toThrow("permission denied");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a mismatched explicit target confirmation before mutation", async () => {
    const data = cancelFormData();
    data.set("confirmedConsultationId", "consultation-other");

    const result = await cancelConsultationForTestResetAction(idle, data);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Preview");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("runs an eligible exact-target cancellation in a serializable transaction", async () => {
    const result = await cancelConsultationForTestResetAction(idle, cancelFormData());

    expect(result.status).toBe("success");
    expect(mocks.cancel).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorId: "admin-1",
        consultationId: "consultation-1",
        expectedStatus: "pending_payment",
        expectedUpdatedAt: new Date("2026-09-05T09:00:00.000Z"),
        reason: "test_data_reset"
      }
    );
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/payments");
  });
});
