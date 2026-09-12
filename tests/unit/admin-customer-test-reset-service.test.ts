import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));

vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  CustomerTestResetError,
  previewCustomerTestReset,
  resetCustomerTestAccount
} from "@/features/admin/customers/test-reset-service";

const updatedAt = new Date("2026-09-12T08:00:00.000Z");

function emptyModel() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 })
  };
}

function createTransaction(options?: { withOrders?: boolean }) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "customer-1" }]),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: "customer-1",
        lineUserId: "line-test-1",
        role: "customer",
        updatedAt,
        doctorProfile: null,
        pharmacistProfile: null
      }),
      delete: vi.fn().mockResolvedValue({ id: "customer-1" })
    },
    consultAssessment: emptyModel(),
    consultation: emptyModel(),
    prescription: emptyModel(),
    order: emptyModel(),
    payment: emptyModel(),
    article: emptyModel(),
    comment: emptyModel(),
    like: emptyModel(),
    savedArticle: emptyModel(),
    communityReport: emptyModel(),
    fileAttachment: emptyModel(),
    consentRecord: emptyModel(),
    telemedicineConsent: emptyModel(),
    authSession: emptyModel(),
    consultationMessage: emptyModel(),
    shippingAddress: emptyModel(),
    notification: emptyModel(),
    rewardPoint: emptyModel(),
    consultationSlotLock: emptyModel(),
    inventory: emptyModel(),
    shipmentTracking: emptyModel(),
    auditLog: emptyModel(),
    phoneVerificationChallenge: emptyModel(),
    consultationRecordingWebhookEvent: emptyModel(),
    consultationRecording: emptyModel(),
    consultationAttendanceEvent: emptyModel(),
    consultationAttendanceCredential: emptyModel(),
    orderItem: emptyModel(),
    orderShippingAddress: emptyModel()
  };

  if (options?.withOrders) {
    tx.order.findMany.mockResolvedValue([
      {
        id: "order-pending",
        status: "pending_payment",
        updatedAt,
        items: [{ id: "item-1", productId: "product-reserved", quantity: 2 }],
        payments: [{ id: "payment-1", status: "pending_slip", updatedAt }]
      },
      {
        id: "order-paid",
        status: "paid",
        updatedAt,
        items: [{ id: "item-2", productId: "product-consumed", quantity: 3 }],
        payments: [{ id: "payment-2", status: "verified", updatedAt }]
      }
    ]);
    tx.payment.findMany.mockResolvedValue([
      { id: "payment-1", status: "pending_slip", updatedAt },
      { id: "payment-2", status: "verified", updatedAt }
    ]);
    tx.inventory.findMany.mockResolvedValue([
      { productId: "product-reserved", reservedQuantity: 2 },
      { productId: "product-consumed", reservedQuantity: 0 }
    ]);
  }

  return tx;
}

describe("customer test account reset service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CUSTOMER_TEST_RESET_LINE_USER_IDS = "line-other,line-test-1";
  });

  afterEach(() => {
    delete process.env.CUSTOMER_TEST_RESET_LINE_USER_IDS;
  });

  it("fails closed when the LINE identity is not in the UAT allowlist", async () => {
    const tx = createTransaction();
    process.env.CUSTOMER_TEST_RESET_LINE_USER_IDS = "line-other";

    const preview = await previewCustomerTestReset(tx as unknown as Prisma.TransactionClient, "customer-1");

    expect(preview).toEqual({ code: "not_test_account", eligible: false });
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });

  it("blocks customer reset when a historical staff profile is still attached", async () => {
    const tx = createTransaction();
    tx.user.findUnique.mockResolvedValueOnce({
      id: "customer-1",
      lineUserId: "line-test-1",
      role: "customer",
      updatedAt,
      doctorProfile: { id: "doctor-1" },
      pharmacistProfile: null
    });

    const preview = await previewCustomerTestReset(tx as unknown as Prisma.TransactionClient, "customer-1");

    expect(preview).toEqual({ code: "staff_profile_present", eligible: false });
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });

  it("deletes dependent UAT data and restores reserved and consumed inventory atomically", async () => {
    const tx = createTransaction({ withOrders: true });
    const preview = await previewCustomerTestReset(tx as unknown as Prisma.TransactionClient, "customer-1");
    expect(preview.code).toBe("eligible");
    expect(preview.counts).toEqual(expect.objectContaining({
      orders: 2,
      payments: 2,
      reservedUnitsToRelease: 2,
      stockUnitsToRestore: 3
    }));

    const result = await resetCustomerTestAccount(tx as unknown as Prisma.TransactionClient, {
      actorId: "admin-1",
      customerId: "customer-1",
      expectedUpdatedAt: updatedAt,
      expectedFingerprint: preview.target!.expectedFingerprint,
      confirmationText: "RESET LINE •••test-1"
    });

    expect(result.removedUserId).toBe("customer-1");
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { productId: "product-consumed", reservedQuantity: { gte: 0 } },
      data: { quantity: { increment: 3 } }
    });
    expect(tx.inventory.updateMany).toHaveBeenCalledWith({
      where: { productId: "product-reserved", reservedQuantity: { gte: 2 } },
      data: { reservedQuantity: { decrement: 2 } }
    });
    expect(tx.payment.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["payment-1", "payment-2"] } }
    });
    expect(tx.order.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["order-pending", "order-paid"] } }
    });
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({ where: { userId: "customer-1" } });
    expect(tx.phoneVerificationChallenge.deleteMany).toHaveBeenCalledWith({ where: { userId: "customer-1" } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "customer-1" } });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: "admin-1",
        action: "customer.test_account_reset",
        entityId: "customer-1"
      })
    );
  });

  it("rejects a stale Preview fingerprint before changing inventory or deleting records", async () => {
    const tx = createTransaction();

    await expect(
      resetCustomerTestAccount(tx as unknown as Prisma.TransactionClient, {
        actorId: "admin-1",
        customerId: "customer-1",
        expectedUpdatedAt: updatedAt,
        expectedFingerprint: "f".repeat(64),
        confirmationText: "RESET LINE •••test-1"
      })
    ).rejects.toEqual(new CustomerTestResetError("STALE_PREVIEW"));
    expect(tx.inventory.updateMany).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("fails Preview when paid-order and payment state are inconsistent", async () => {
    const tx = createTransaction({ withOrders: true });
    tx.order.findMany.mockResolvedValueOnce([
      {
        id: "order-paid",
        status: "paid",
        updatedAt,
        items: [{ id: "item-2", productId: "product-consumed", quantity: 3 }],
        payments: [{ id: "payment-2", status: "pending_review", updatedAt }]
      }
    ]);

    const preview = await previewCustomerTestReset(tx as unknown as Prisma.TransactionClient, "customer-1");

    expect(preview).toEqual({ code: "data_conflict", eligible: false });
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});
