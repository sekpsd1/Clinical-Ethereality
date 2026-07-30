import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  applyManualPaymentReview: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn()
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

vi.mock("@/features/payments/service", () => ({
  applyManualPaymentReview: mocks.applyManualPaymentReview
}));

import { reviewPaymentAction } from "@/features/admin/payments/actions";

describe("admin payment review action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      userId: "admin-1",
      role: "admin"
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => callback({}));
  });

  it("runs manual payment review in a serializable transaction", async () => {
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("status", "verified");

    const result = await reviewPaymentAction(
      {
        status: "idle",
        message: ""
      },
      formData
    );

    expect(result.status).toBe("success");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.applyManualPaymentReview).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorId: "admin-1",
        paymentId: "payment-1",
        status: "verified"
      }
    );
  });
});
