import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local", quiet: true });

const { prisma } = await import("@/lib/db/prisma");
const { cancelCustomerPendingStoreOrder, releaseExpiredStoreOrderReservations } =
  await import("@/features/orders/reservations");

const describeWithLocalDatabase =
  process.env.RUN_LOCAL_DB_INTEGRATION === "true" ? describe : describe.skip;

describeWithLocalDatabase("Customer order cancellation Local DB integration", () => {
  const fixtureKey = randomUUID();
  const lineUserId = `cancel-order-integration-${fixtureKey}`;
  const productSlug = `cancel-order-integration-${fixtureKey}`;
  const expiredAt = new Date("2026-08-08T08:00:00.000Z");
  let userId = "";
  let orderId = "";
  let paidOrderId = "";
  let productId = "";

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        lineUserId,
        displayName: "Customer cancellation integration",
        role: "customer",
        status: "active"
      },
      select: {
        id: true
      }
    });
    userId = user.id;

    const product = await prisma.product.create({
      data: {
        name: "Customer cancellation integration product",
        slug: productSlug,
        price: 100,
        status: "active",
        inventory: {
          create: {
            quantity: 10,
            reservedQuantity: 2
          }
        }
      },
      select: {
        id: true
      }
    });
    productId = product.id;

    const [unpaidOrder, paidOrder] = await Promise.all([
      prisma.order.create({
        data: {
          userId,
          status: "pending_payment",
          subtotal: 100,
          grandTotal: 100,
          createdAt: expiredAt,
          items: {
            create: {
              productId,
              quantity: 1,
              unitPrice: 100,
              lineTotal: 100
            }
          },
          payments: {
            create: {
              amount: 100,
              status: "pending_slip"
            }
          },
          shipments: {
            create: {
              status: "pending"
            }
          }
        },
        select: {
          id: true
        }
      }),
      prisma.order.create({
        data: {
          userId,
          status: "pending_payment",
          subtotal: 100,
          grandTotal: 100,
          createdAt: expiredAt,
          items: {
            create: {
              productId,
              quantity: 1,
              unitPrice: 100,
              lineTotal: 100
            }
          },
          payments: {
            create: {
              amount: 100,
              status: "verified"
            }
          },
          shipments: {
            create: {
              status: "pending"
            }
          }
        },
        select: {
          id: true
        }
      })
    ]);

    orderId = unpaidOrder.id;
    paidOrderId = paidOrder.id;
  });

  afterAll(async () => {
    const orderIds = [orderId, paidOrderId].filter(Boolean);

    if (orderIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { entityType: "order", entityId: { in: orderIds } } });
      await prisma.shipmentTracking.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.orderShippingAddress.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (userId) {
      await prisma.notification.deleteMany({ where: { userId } });
    }

    if (productId) {
      await prisma.inventory.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }

    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("keeps ownership private and blocks an order with a successful payment", async () => {
    await expect(
      cancelCustomerPendingStoreOrder({ orderId, userId: "another-customer" })
    ).resolves.toBe("not_found");
    await expect(
      cancelCustomerPendingStoreOrder({ orderId: paidOrderId, userId })
    ).resolves.toBe("blocked");

    const paidOrder = await prisma.order.findUniqueOrThrow({
      where: { id: paidOrderId },
      include: { payments: true, shipments: true }
    });
    expect(paidOrder.status).toBe("pending_payment");
    expect(paidOrder.payments[0]?.status).toBe("verified");
    expect(paidOrder.shipments[0]?.status).toBe("pending");
  });

  it("cancels once when the customer races the global cleanup worker and remains idempotent", async () => {
    const [customerResult, cleanupResult] = await Promise.all([
      cancelCustomerPendingStoreOrder({ orderId, userId }),
      releaseExpiredStoreOrderReservations({
        userId,
        now: new Date("2026-08-08T08:30:00.000Z")
      })
    ]);

    expect(["cancelled", "already_cancelled"]).toContain(customerResult);
    expect(cleanupResult.candidates).toBe(2);
    expect(cleanupResult.released).toBeLessThanOrEqual(1);

    const [order, inventory, auditCount, notificationCount] = await Promise.all([
      prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { payments: true, shipments: true }
      }),
      prisma.inventory.findUniqueOrThrow({ where: { productId } }),
      prisma.auditLog.count({ where: { entityType: "order", entityId: orderId } }),
      prisma.notification.count({ where: { userId, type: "order" } })
    ]);

    expect(order.status).toBe("cancelled");
    expect(order.payments[0]?.status).toBe("rejected");
    expect(order.shipments[0]?.status).toBe("cancelled");
    expect(inventory.reservedQuantity).toBe(1);
    expect(auditCount).toBe(1);
    expect(notificationCount).toBe(1);

    await expect(
      cancelCustomerPendingStoreOrder({ orderId, userId })
    ).resolves.toBe("already_cancelled");

    const [inventoryAfterRerun, auditCountAfterRerun, notificationCountAfterRerun] =
      await Promise.all([
        prisma.inventory.findUniqueOrThrow({ where: { productId } }),
        prisma.auditLog.count({ where: { entityType: "order", entityId: orderId } }),
        prisma.notification.count({ where: { userId, type: "order" } })
      ]);

    expect(inventoryAfterRerun.reservedQuantity).toBe(1);
    expect(auditCountAfterRerun).toBe(1);
    expect(notificationCountAfterRerun).toBe(1);
  });
});
