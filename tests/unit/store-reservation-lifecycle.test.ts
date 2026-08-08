import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reservationMocks = vi.hoisted(() => ({
  candidateFindMany: vi.fn(),
  prismaTransaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    order: {
      findMany: reservationMocks.candidateFindMany
    },
    $transaction: reservationMocks.prismaTransaction
  }
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: reservationMocks.writeAuditLog
}));

import {
  aggregateOrderItemQuantities,
  assertStorePendingOrderCapacity,
  getStorePaymentReviewExpiresAt,
  getStoreReservationExpiresAt,
  isStorePaymentReviewExpired,
  isStoreReservationExpired,
  MAX_ACTIVE_STORE_ORDERS_PER_CUSTOMER,
  releaseExpiredStoreOrderReservations,
  StorePendingOrderLimitError
} from "@/features/orders/reservations";

function createReleaseTransaction(options: {
  inventoryReleaseCount?: number;
  statusClaimCount?: number;
} = {}) {
  return {
    order: {
      findFirst: vi.fn().mockResolvedValue({
        id: "order-1",
        userId: "customer-1",
        status: "pending_payment",
        createdAt: new Date("2026-07-30T08:00:00.000Z"),
        updatedAt: new Date("2026-07-30T08:00:00.000Z"),
        items: [
          {
            productId: "product-1",
            quantity: 2
          },
          {
            productId: "product-1",
            quantity: 1
          }
        ]
      }),
      updateMany: vi.fn().mockResolvedValue({
        count: options.statusClaimCount ?? 1
      })
    },
    inventory: {
      updateMany: vi.fn().mockResolvedValue({
        count: options.inventoryReleaseCount ?? 1
      })
    },
    shipmentTracking: {
      updateMany: vi.fn().mockResolvedValue({
        count: 1
      })
    },
    payment: {
      updateMany: vi.fn().mockResolvedValue({
        count: 1
      })
    },
    notification: {
      create: vi.fn().mockResolvedValue({
        id: "notification-1"
      })
    }
  };
}

function useReleaseTransaction(tx: ReturnType<typeof createReleaseTransaction>) {
  reservationMocks.prismaTransaction.mockImplementation(
    async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx)
  );
}

describe("Store reservation lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reservationMocks.candidateFindMany.mockResolvedValue([
      {
        id: "order-1",
        status: "pending_payment"
      }
    ]);
  });

  it("aggregates repeated order-item quantities by product", () => {
    expect(
      Object.fromEntries(
        aggregateOrderItemQuantities([
          {
            productId: "product-1",
            quantity: 2
          },
          {
            productId: "product-2",
            quantity: 4
          },
          {
            productId: "product-1",
            quantity: 3
          }
        ])
      )
    ).toEqual({
      "product-1": 5,
      "product-2": 4
    });
  });

  it("expires a pending Store reservation at the 30-minute boundary", () => {
    const createdAt = new Date("2026-07-30T08:00:00.000Z");

    expect(getStoreReservationExpiresAt(createdAt)).toEqual(
      new Date("2026-07-30T08:30:00.000Z")
    );
    expect(
      isStoreReservationExpired(createdAt, new Date("2026-07-30T08:29:59.999Z"))
    ).toBe(false);
    expect(
      isStoreReservationExpired(createdAt, new Date("2026-07-30T08:30:00.000Z"))
    ).toBe(true);
  });

  it("expires a payment-review reservation at the 24-hour boundary", () => {
    const createdAt = new Date("2026-07-30T08:00:00.000Z");

    expect(getStorePaymentReviewExpiresAt(createdAt)).toEqual(
      new Date("2026-07-31T08:00:00.000Z")
    );
    expect(
      isStorePaymentReviewExpired(createdAt, new Date("2026-07-31T07:59:59.999Z"))
    ).toBe(false);
    expect(
      isStorePaymentReviewExpired(createdAt, new Date("2026-07-31T08:00:00.000Z"))
    ).toBe(true);
  });

  it("claims the expired order before releasing aggregated stock and preserves payment metadata", async () => {
    const tx = createReleaseTransaction();
    useReleaseTransaction(tx);

    await expect(
      releaseExpiredStoreOrderReservations({
        now: new Date("2026-07-30T08:30:00.000Z"),
        userId: "customer-1"
      })
    ).resolves.toEqual({
      candidates: 1,
      released: 1,
      skipped: 0
    });

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: "order-1",
        status: "pending_payment",
        createdAt: {
          lte: new Date("2026-07-30T08:00:00.000Z")
        },
        payments: {
          none: {
            status: {
              in: ["verified", "refunded"]
            }
          }
        }
      },
      data: {
        status: "cancelled"
      }
    });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: {
        productId: "product-1",
        reservedQuantity: {
          gte: 3
        }
      },
      data: {
        reservedQuantity: {
          decrement: 3
        }
      }
    });
    expect(tx.order.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.inventory.updateMany.mock.invocationCallOrder[0]
    );
    expect(tx.shipmentTracking.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        status: "pending"
      },
      data: {
        status: "cancelled"
      }
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        orderId: "order-1",
        status: {
          notIn: ["verified", "refunded"]
        }
      },
      data: {
        status: "rejected"
      }
    });
    expect(tx.payment.updateMany.mock.calls[0][0].data).not.toHaveProperty(
      "verificationPayload"
    );
    expect(reservationMocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: "order.payment_reservation_expired",
        entityId: "order-1",
        metadata: expect.objectContaining({
          releasedInventory: {
            "product-1": 3
          },
          paymentVerificationPayloadPreserved: true
        })
      })
    );
    expect(reservationMocks.prismaTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
    expect(reservationMocks.candidateFindMany).toHaveBeenCalledWith({
      where: {
        userId: "customer-1",
        OR: [
          {
            status: "pending_payment",
            createdAt: {
              lte: new Date("2026-07-30T08:00:00.000Z")
            }
          },
          {
            status: "payment_review",
            createdAt: {
              lte: new Date("2026-07-29T08:30:00.000Z")
            }
          }
        ]
      },
      orderBy: {
        createdAt: "asc"
      },
      take: 25,
      select: {
        id: true,
        status: true
      }
    });
  });

  it("releases a payment-review hold only after its 24-hour TTL", async () => {
    reservationMocks.candidateFindMany.mockResolvedValue([
      {
        id: "order-1",
        status: "payment_review"
      }
    ]);
    const tx = createReleaseTransaction();
    useReleaseTransaction(tx);

    await expect(
      releaseExpiredStoreOrderReservations({
        now: new Date("2026-07-31T08:00:00.000Z")
      })
    ).resolves.toMatchObject({
      released: 1,
      skipped: 0
    });

    expect(tx.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "order-1",
          status: "payment_review",
          createdAt: {
            lte: new Date("2026-07-30T08:00:00.000Z")
          }
        }
      })
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "order-1",
          status: "payment_review",
          createdAt: {
            lte: new Date("2026-07-30T08:00:00.000Z")
          }
        })
      })
    );
  });

  it("skips inventory and payment mutations when verification wins the order-status CAS", async () => {
    const tx = createReleaseTransaction({
      statusClaimCount: 0
    });
    useReleaseTransaction(tx);

    await expect(
      releaseExpiredStoreOrderReservations({
        now: new Date("2026-07-30T08:30:00.000Z")
      })
    ).resolves.toEqual({
      candidates: 1,
      released: 0,
      skipped: 1
    });

    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.shipmentTracking.updateMany).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(reservationMocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("never decrements reserved inventory without a sufficient-reservation guard", async () => {
    const tx = createReleaseTransaction({
      inventoryReleaseCount: 0
    });
    useReleaseTransaction(tx);

    await expect(
      releaseExpiredStoreOrderReservations({
        now: new Date("2026-07-30T08:30:00.000Z")
      })
    ).resolves.toEqual({
      candidates: 1,
      released: 0,
      skipped: 1
    });

    expect(tx.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reservedQuantity: {
            gte: 3
          }
        })
      })
    );
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });

  it("is idempotent when the same expired candidate is seen again after it was released", async () => {
    const tx = createReleaseTransaction();
    tx.order.findFirst
      .mockResolvedValueOnce({
        id: "order-1",
        userId: "customer-1",
        status: "pending_payment",
        createdAt: new Date("2026-07-30T08:00:00.000Z"),
        updatedAt: new Date("2026-07-30T08:00:00.000Z"),
        items: [{ productId: "product-1", quantity: 1 }]
      })
      .mockResolvedValueOnce(null);
    useReleaseTransaction(tx);

    await expect(
      releaseExpiredStoreOrderReservations({
        now: new Date("2026-07-30T08:30:00.000Z")
      })
    ).resolves.toMatchObject({ released: 1, skipped: 0 });

    await expect(
      releaseExpiredStoreOrderReservations({
        now: new Date("2026-07-30T08:30:00.000Z")
      })
    ).resolves.toMatchObject({ released: 0, skipped: 1 });

    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(reservationMocks.writeAuditLog).toHaveBeenCalledTimes(1);
  });

  it("allows concurrent global runs to release stock exactly once through the order-status CAS", async () => {
    let statusClaimed = false;
    const tx = createReleaseTransaction();
    tx.order.updateMany.mockImplementation(async () => {
      if (statusClaimed) {
        return { count: 0 };
      }

      statusClaimed = true;
      return { count: 1 };
    });
    useReleaseTransaction(tx);

    const results = await Promise.all([
      releaseExpiredStoreOrderReservations({ now: new Date("2026-07-30T08:30:00.000Z") }),
      releaseExpiredStoreOrderReservations({ now: new Date("2026-07-30T08:30:00.000Z") })
    ]);

    expect(results.reduce((total, result) => total + result.released, 0)).toBe(1);
    expect(results.reduce((total, result) => total + result.skipped, 0)).toBe(1);
    expect(tx.inventory.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.payment.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.shipmentTracking.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(reservationMocks.writeAuditLog).toHaveBeenCalledTimes(1);
  });
});

describe("Store pending-order cap", () => {
  it("serializes creation on the customer row and blocks the fourth pending order", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "customer-1"
        }
      ]),
      order: {
        count: vi.fn().mockResolvedValue(MAX_ACTIVE_STORE_ORDERS_PER_CUSTOMER)
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      assertStorePendingOrderCapacity(tx, "customer-1")
    ).rejects.toThrow(StorePendingOrderLimitError);

    const lockQuery = vi.mocked(tx.$queryRaw).mock.calls[0][0] as {
      strings: string[];
      values: unknown[];
    };
    expect(lockQuery.strings.join(" ")).toContain("FOR UPDATE");
    expect(lockQuery.values).toEqual(["customer-1"]);
    expect(tx.order.count).toHaveBeenCalledWith({
      where: {
        userId: "customer-1",
        status: {
          in: ["pending_payment", "payment_review"]
        }
      }
    });
  });
});
