import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  applyManualPaymentReview,
  applyProviderPaymentVerification,
  DuplicatePaymentTransactionError
} from "@/features/payments/service";
import {
  InvalidPaymentTransactionReferenceError,
  normalizePaymentTransactionReference
} from "@/features/payments/transaction-reference";
import { reviewPaymentSchema } from "@/features/admin/payments/schema";

const verifiedProviderResult = {
  ok: true as const,
  provider: "easyslip" as const,
  status: "verified" as const,
  transRef: "  ab-12 / cd_34  ",
  amount: 100,
  receiverName: "Clinical Ethereality",
  raw: null
};

describe("payment transaction reference normalization", () => {
  it.each([
    "ab-12/cd_34",
    " AB 12 . cd:34 ",
    "ａｂ－１２／ｃｄ＿３４"
  ])("canonicalizes equivalent bank reference %s", (reference) => {
    expect(normalizePaymentTransactionReference(reference)).toBe("AB12CD34");
  });

  it.each(["", "   ", "ref#123", "a".repeat(192)])("rejects an unsafe reference %j", (reference) => {
    expect(() => normalizePaymentTransactionReference(reference)).toThrow(
      InvalidPaymentTransactionReferenceError
    );
  });

  it("requires and normalizes the reference before manual approval", () => {
    expect(
      reviewPaymentSchema.safeParse({
        paymentId: "payment-1",
        status: "verified",
        transactionReference: " manual-ref / 1 "
      })
    ).toMatchObject({
      success: true,
      data: expect.objectContaining({ transactionReference: "MANUALREF1" })
    });
    expect(
      reviewPaymentSchema.safeParse({ paymentId: "payment-1", status: "verified" }).success
    ).toBe(false);
    expect(
      reviewPaymentSchema.safeParse({ paymentId: "payment-1", status: "rejected" }).success
    ).toBe(true);
  });
});

describe("payment transaction reference enforcement", () => {
  it("rejects a normalized provider collision before any order, stock, reward, or notification write", async () => {
    const orderUpdateMany = vi.fn();
    const inventoryUpdateMany = vi.fn();
    const rewardPointCreate = vi.fn();
    const notificationCreate = vi.fn();
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({ id: "payment-existing" }),
        updateMany: vi.fn()
      },
      order: { updateMany: orderUpdateMany },
      inventory: { updateMany: inventoryUpdateMany },
      rewardPoint: { create: rewardPointCreate },
      notification: { create: notificationCreate }
    } as unknown as Prisma.TransactionClient;

    await expect(
      applyProviderPaymentVerification(tx, {
        actorId: "customer-1",
        payment: {
          id: "payment-1",
          orderId: "order-1",
          orderUserId: "customer-1",
          amount: new Prisma.Decimal(100),
          status: "pending_review",
          slipImageUrl: null,
          verificationPayload: null,
          updatedAt: new Date("2026-08-09T10:00:00.000Z")
        },
        result: verifiedProviderResult,
        source: "qr_payload"
      })
    ).rejects.toBeInstanceOf(DuplicatePaymentTransactionError);

    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
    expect(rewardPointCreate).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate manual-review reference before changing the payment or order", async () => {
    const paymentUpdateMany = vi.fn();
    const orderUpdateMany = vi.fn();
    const tx = {
      payment: {
        findUnique: vi.fn().mockResolvedValue({
          id: "payment-1",
          orderId: "order-1",
          amount: new Prisma.Decimal(100),
          status: "pending_review",
          verificationPayload: null,
          order: { userId: "customer-1" }
        }),
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "payment-existing" }),
        updateMany: paymentUpdateMany
      },
      order: { updateMany: orderUpdateMany }
    } as unknown as Prisma.TransactionClient;

    await expect(
      applyManualPaymentReview(tx, {
        actorId: "admin-1",
        paymentId: "payment-1",
        status: "verified",
        transactionReference: "manual-reference-1"
      })
    ).rejects.toBeInstanceOf(DuplicatePaymentTransactionError);

    expect(paymentUpdateMany).not.toHaveBeenCalled();
    expect(orderUpdateMany).not.toHaveBeenCalled();
  });

  it("fails closed when a concurrent provider verification loses the unique index race", async () => {
    const orderUpdateMany = vi.fn();
    const inventoryUpdateMany = vi.fn();
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockRejectedValue({
          code: "P2002",
          meta: { target: ["normalizedTransactionReference"] }
        })
      },
      order: { updateMany: orderUpdateMany },
      inventory: { updateMany: inventoryUpdateMany }
    } as unknown as Prisma.TransactionClient;

    await expect(
      applyProviderPaymentVerification(tx, {
        actorId: "customer-1",
        payment: {
          id: "payment-1",
          orderId: "order-1",
          orderUserId: "customer-1",
          amount: new Prisma.Decimal(100),
          status: "pending_review",
          slipImageUrl: null,
          verificationPayload: null,
          updatedAt: new Date("2026-08-09T10:00:00.000Z")
        },
        result: verifiedProviderResult,
        source: "qr_payload"
      })
    ).rejects.toBeInstanceOf(DuplicatePaymentTransactionError);

    expect(orderUpdateMany).not.toHaveBeenCalled();
    expect(inventoryUpdateMany).not.toHaveBeenCalled();
  });
});
