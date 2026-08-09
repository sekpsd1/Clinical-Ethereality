import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local", quiet: true });

const { prisma } = await import("@/lib/db/prisma");
const { applyManualStoreRefund } = await import("@/features/payments/refunds");

const describeWithLocalDatabase = process.env.RUN_LOCAL_DB_INTEGRATION === "true" ? describe : describe.skip;

describeWithLocalDatabase("Manual Store refund Local DB integration", () => {
  const fixtureKey = randomUUID();
  let customerId = "";
  let adminId = "";
  let productId = "";
  let orderId = "";
  let paymentId = "";

  beforeAll(async () => {
    const [customer, admin] = await Promise.all([
      prisma.user.create({
        data: { lineUserId: `refund-customer-${fixtureKey}`, role: "customer", status: "active", rewardBalance: 1 },
        select: { id: true }
      }),
      prisma.user.create({
        data: { lineUserId: `refund-admin-${fixtureKey}`, role: "admin", status: "active" },
        select: { id: true }
      })
    ]);
    customerId = customer.id;
    adminId = admin.id;

    const product = await prisma.product.create({
      data: {
        name: `Refund integration product ${fixtureKey}`,
        slug: `refund-integration-${fixtureKey}`,
        price: 100,
        status: "active",
        inventory: { create: { quantity: 8, reservedQuantity: 0 } }
      },
      select: { id: true }
    });
    productId = product.id;

    const order = await prisma.order.create({
      data: {
        userId: customerId,
        status: "paid",
        subtotal: 100,
        grandTotal: 100,
        items: { create: { productId, quantity: 2, unitPrice: 50, lineTotal: 100 } },
        payments: {
          create: {
            amount: 100,
            status: "verified",
            normalizedTransactionReference: "INCOMINGREFUNDTEST1"
          }
        },
        shipments: { create: { status: "pending" } }
      },
      include: { payments: { select: { id: true } }
      }
    });
    orderId = order.id;
    paymentId = order.payments[0]!.id;

    await prisma.rewardPoint.create({
      data: { userId: customerId, sourceType: "order", sourceId: orderId, direction: "earn", points: 10 }
    });
  });

  afterAll(async () => {
    if (orderId) {
      await prisma.auditLog.deleteMany({ where: { entityType: "payment", entityId: paymentId } });
      await prisma.notification.deleteMany({ where: { userId: customerId } });
      await prisma.rewardPoint.deleteMany({ where: { userId: customerId, sourceId: orderId } });
      await prisma.shipmentTracking.deleteMany({ where: { orderId } });
      await prisma.payment.deleteMany({ where: { orderId } });
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.order.deleteMany({ where: { id: orderId } });
    }
    if (productId) {
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [customerId, adminId].filter(Boolean) } } });
  });

  it("records one full refund, preserves the incoming reference, restores stock, and permits negative rewards", async () => {
    const outcome = await prisma.$transaction(
      (tx) =>
        applyManualStoreRefund(tx, {
          actorId: adminId,
          paymentId,
          refundAmount: "100.00",
          refundReason: "Local integration refund",
          refundTransactionReference: "outgoing-refund / 1"
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    expect(outcome).toBe("refunded");

    const [order, inventory, customer, reversalCount, notificationCount, auditCount] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, shipments: true } }),
      prisma.inventory.findUniqueOrThrow({ where: { productId } }),
      prisma.user.findUniqueOrThrow({ where: { id: customerId } }),
      prisma.rewardPoint.count({ where: { userId: customerId, sourceId: orderId, direction: "adjust" } }),
      prisma.notification.count({ where: { userId: customerId, type: "payment" } }),
      prisma.auditLog.count({ where: { entityType: "payment", entityId: paymentId, action: "payment.manual_store_refund" } })
    ]);
    const payment = order.payments[0]!;

    expect(order.status).toBe("refunded");
    expect(order.shipments[0]?.status).toBe("cancelled");
    expect(payment.status).toBe("refunded");
    expect(payment.normalizedTransactionReference).toBe("INCOMINGREFUNDTEST1");
    expect(payment.normalizedRefundReference).toBe("OUTGOINGREFUND1");
    expect(payment.refundAmount?.toString()).toBe("100");
    expect(inventory.quantity).toBe(10);
    expect(customer.rewardBalance).toBe(-9);
    expect(reversalCount).toBe(1);
    expect(notificationCount).toBe(1);
    expect(auditCount).toBe(1);
  });

  it("is idempotent after refund and does not restore stock or rewards twice", async () => {
    const outcome = await prisma.$transaction(
      (tx) =>
        applyManualStoreRefund(tx, {
          actorId: adminId,
          paymentId,
          refundAmount: "100.00",
          refundReason: "Repeat",
          refundTransactionReference: "different-reference"
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const [inventory, reversalCount, notificationCount] = await Promise.all([
      prisma.inventory.findUniqueOrThrow({ where: { productId } }),
      prisma.rewardPoint.count({ where: { userId: customerId, sourceId: orderId, direction: "adjust" } }),
      prisma.notification.count({ where: { userId: customerId, type: "payment" } })
    ]);

    expect(outcome).toBe("already_refunded");
    expect(inventory.quantity).toBe(10);
    expect(reversalCount).toBe(1);
    expect(notificationCount).toBe(1);
  });
});
