import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  applyManualStoreRefund,
  DuplicateRefundReferenceError,
  ManualStoreRefundEligibilityError
} from "@/features/payments/refunds";

function createTransaction(input?: {
  orderStatus?: "paid" | "preparing" | "shipped" | "delivered" | "cancelled" | "refunded";
  paymentStatus?: "verified" | "refunded" | "pending_review";
  shipmentStatus?: "pending" | "preparing" | "shipped" | "delivered";
  duplicateRefund?: boolean;
  paymentUpdateError?: unknown;
}) {
  const paymentStatus = input?.paymentStatus ?? "verified";
  const orderStatus = input?.orderStatus ?? "paid";
  const payment = {
    id: "payment-1",
    amount: new Prisma.Decimal(100),
    orderId: "order-1",
    status: paymentStatus,
    normalizedTransactionReference: "INCOMING1",
    order: {
      id: "order-1",
      userId: "customer-1",
      status: orderStatus,
      items: [{ productId: "product-1", quantity: 2 }],
      shipments: [{ status: input?.shipmentStatus ?? "pending" }]
    }
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "order-1" }]),
    payment: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ id: "payment-1", orderId: "order-1" })
        .mockResolvedValueOnce(payment),
      findFirst: vi.fn().mockResolvedValue(input?.duplicateRefund ? { id: "payment-existing" } : null),
      updateMany: input?.paymentUpdateError
        ? vi.fn().mockRejectedValue(input.paymentUpdateError)
        : vi.fn().mockResolvedValue({ count: 1 })
    },
    order: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    shipmentTracking: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    inventory: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    rewardPoint: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({ points: 10 })
        .mockResolvedValueOnce(null),
      create: vi.fn().mockResolvedValue({ id: "reward-reversal-1" })
    },
    user: {
      update: vi.fn().mockResolvedValue({ id: "customer-1" })
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notification-1" })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" })
    }
  } as unknown as Prisma.TransactionClient;

  return { tx, payment };
}

const refundInput = {
  actorId: "admin-1",
  paymentId: "payment-1",
  refundAmount: "100.00",
  refundReason: "สินค้าไม่พร้อมจัดส่ง",
  refundTransactionReference: " refund-1 / bank "
};

describe("manual Store refunds", () => {
  it.each(["paid", "preparing"] as const)("refunds eligible %s Store orders once", async (orderStatus) => {
    const { tx } = createTransaction({ orderStatus });

    await expect(applyManualStoreRefund(tx, refundInput)).resolves.toBe("refunded");

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "refunded",
          normalizedRefundReference: "REFUND1BANK",
          refundAmount: expect.any(Prisma.Decimal),
          refundTransactionReference: "refund-1 / bank"
        })
      })
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: { in: ["paid", "preparing"] } },
      data: { status: "refunded" }
    });
    expect(tx.shipmentTracking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "cancelled", updatedById: "admin-1" } })
    );
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { productId: "product-1" },
      data: { quantity: { increment: 2 } }
    });
    expect(tx.rewardPoint.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: "adjust", points: -10, sourceId: "order-1" }) })
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "customer-1" },
      data: { rewardBalance: { decrement: 10 } }
    });
    expect(tx.notification.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "payment.manual_store_refund" }) })
    );
  });

  it("allows a negative reward balance rather than blocking a real refund", async () => {
    const { tx } = createTransaction();

    await applyManualStoreRefund(tx, refundInput);

    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { rewardBalance: { decrement: 10 } } })
    );
  });

  it.each([
    ["pending_review", "paid", "pending"],
    ["verified", "shipped", "shipped"],
    ["verified", "delivered", "delivered"],
    ["verified", "cancelled", "pending"]
  ] as const)("blocks ineligible payment/order state %s/%s", async (paymentStatus, orderStatus, shipmentStatus) => {
    const { tx } = createTransaction({ paymentStatus, orderStatus, shipmentStatus });

    await expect(applyManualStoreRefund(tx, refundInput)).rejects.toBeInstanceOf(ManualStoreRefundEligibilityError);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
  });

  it("blocks partial amounts before any refund write", async () => {
    const { tx } = createTransaction();

    await expect(applyManualStoreRefund(tx, { ...refundInput, refundAmount: "99.99" })).rejects.toBeInstanceOf(
      ManualStoreRefundEligibilityError
    );
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it("blocks an existing normalized refund reference without changing stock or rewards", async () => {
    const { tx } = createTransaction({ duplicateRefund: true });

    await expect(applyManualStoreRefund(tx, refundInput)).rejects.toBeInstanceOf(DuplicateRefundReferenceError);
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.rewardPoint.create).not.toHaveBeenCalled();
  });

  it("fails closed on a concurrent unique-reference collision", async () => {
    const { tx } = createTransaction({
      paymentUpdateError: { code: "P2002", meta: { target: ["normalizedRefundReference"] } }
    });

    await expect(applyManualStoreRefund(tx, refundInput)).rejects.toBeInstanceOf(DuplicateRefundReferenceError);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.rewardPoint.create).not.toHaveBeenCalled();
  });

  it("is idempotent after a complete refund without stock, reward, notification, or audit duplication", async () => {
    const { tx } = createTransaction({ paymentStatus: "refunded", orderStatus: "refunded" });

    await expect(applyManualStoreRefund(tx, refundInput)).resolves.toBe("already_refunded");
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.rewardPoint.create).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
