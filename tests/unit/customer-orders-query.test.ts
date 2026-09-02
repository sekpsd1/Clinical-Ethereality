import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  noStore: vi.fn(),
  orderFindMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({
  unstable_noStore: mocks.noStore
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: {
      findMany: mocks.orderFindMany
    },
    fileAttachment: {
      findMany: vi.fn()
    },
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/payments/promptpay", () => ({
  getQrDataUrlFromPayload: vi.fn()
}));

vi.mock("@/features/payments/service", () => ({
  isPaymentReadyForProviderVerification: vi.fn()
}));

import { getCustomerOrders } from "@/features/orders/queries";

describe("customer order queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderFindMany.mockResolvedValue([]);
  });

  it("does not mutate reservations while reading an empty customer order list", async () => {
    await expect(getCustomerOrders({ userId: "customer-1" } as never)).resolves.toEqual({
      orders: [],
      summary: {
        active: 0,
        paymentReview: 0,
        completed: 0
      }
    });

    expect(mocks.noStore).toHaveBeenCalledOnce();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
