import type { OrderStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { prisma } from "@/lib/db/prisma";

export const STORE_RESERVATION_TTL_MINUTES = 30;
export const STORE_PAYMENT_REVIEW_TTL_HOURS = 24;
export const MAX_ACTIVE_STORE_ORDERS_PER_CUSTOMER = 3;
export const STORE_RESERVATION_TTL_MS = STORE_RESERVATION_TTL_MINUTES * 60 * 1000;
export const STORE_PAYMENT_REVIEW_TTL_MS = STORE_PAYMENT_REVIEW_TTL_HOURS * 60 * 60 * 1000;
const STORE_RESERVATION_CLEANUP_BATCH_SIZE = 25;
const COMPLETED_PAYMENT_STATUSES = ["verified", "refunded"] as const;

type OrderItemQuantity = {
  productId: string;
  quantity: number;
};

type ReleaseExpiredStoreOrderReservationsInput = {
  now?: Date;
  userId?: string;
};

type ReleasableStoreOrderStatus = Extract<OrderStatus, "pending_payment" | "payment_review">;

type StoreReservationReleaseCandidate = {
  id: string;
  status: ReleasableStoreOrderStatus;
};

export type StoreReservationReleaseResult = {
  candidates: number;
  released: number;
  skipped: number;
};

export class StorePendingOrderLimitError extends Error {
  constructor() {
    super(
      `A customer can have at most ${MAX_ACTIVE_STORE_ORDERS_PER_CUSTOMER} Store orders awaiting payment or payment review.`
    );
    this.name = "StorePendingOrderLimitError";
  }
}

export function getStoreReservationExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + STORE_RESERVATION_TTL_MS);
}

export function isStoreReservationExpired(createdAt: Date, now = new Date()): boolean {
  return getStoreReservationExpiresAt(createdAt).getTime() <= now.getTime();
}

export function getStorePaymentReviewExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + STORE_PAYMENT_REVIEW_TTL_MS);
}

export function isStorePaymentReviewExpired(createdAt: Date, now = new Date()): boolean {
  return getStorePaymentReviewExpiresAt(createdAt).getTime() <= now.getTime();
}

class StoreReservationReleaseConflictError extends Error {
  constructor() {
    super("Reserved inventory changed while an expired Store order was being released.");
    this.name = "StoreReservationReleaseConflictError";
  }
}

export function aggregateOrderItemQuantities(
  items: readonly OrderItemQuantity[]
): Map<string, number> {
  return items.reduce((quantities, item) => {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    return quantities;
  }, new Map<string, number>());
}

export async function assertStorePendingOrderCapacity(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  const lockedCustomers = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT \`id\`
      FROM \`User\`
      WHERE \`id\` = ${userId}
      FOR UPDATE
    `
  );

  if (lockedCustomers.length !== 1) {
    throw new Error("Customer account was not found while checking Store order capacity.");
  }

  const pendingOrderCount = await tx.order.count({
    where: {
      userId,
      status: {
        in: ["pending_payment", "payment_review"]
      }
    }
  });

  if (pendingOrderCount >= MAX_ACTIVE_STORE_ORDERS_PER_CUSTOMER) {
    throw new StorePendingOrderLimitError();
  }
}

function isExpectedReleaseConflict(error: unknown): boolean {
  if (error instanceof StoreReservationReleaseConflictError) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2034"
  );
}

async function releaseExpiredStoreOrderReservation(
  candidate: StoreReservationReleaseCandidate,
  cutoff: Date
): Promise<boolean> {
  const expiryWhere =
    candidate.status === "pending_payment"
      ? {
          createdAt: {
            lte: cutoff
          }
        }
      : {
          createdAt: {
            lte: cutoff
          }
        };

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        id: candidate.id,
        status: candidate.status,
        ...expiryWhere
      },
      select: {
        id: true,
        userId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            productId: true,
            quantity: true
          }
        }
      }
    });

    if (!order) {
      return false;
    }

    const statusClaim = await tx.order.updateMany({
      where: {
        id: order.id,
        status: candidate.status,
        ...expiryWhere,
        payments: {
          none: {
            status: {
              in: [...COMPLETED_PAYMENT_STATUSES]
            }
          }
        }
      },
      data: {
        status: "cancelled"
      }
    });

    if (statusClaim.count !== 1) {
      return false;
    }

    const quantities = aggregateOrderItemQuantities(order.items);

    for (const [productId, quantity] of quantities) {
      const inventoryRelease = await tx.inventory.updateMany({
        where: {
          productId,
          reservedQuantity: {
            gte: quantity
          }
        },
        data: {
          reservedQuantity: {
            decrement: quantity
          }
        }
      });

      if (inventoryRelease.count !== 1) {
        throw new StoreReservationReleaseConflictError();
      }
    }

    const [cancelledShipments, rejectedPayments] = await Promise.all([
      tx.shipmentTracking.updateMany({
        where: {
          orderId: order.id,
          status: "pending"
        },
        data: {
          status: "cancelled"
        }
      }),
      tx.payment.updateMany({
        where: {
          orderId: order.id,
          status: {
            notIn: [...COMPLETED_PAYMENT_STATUSES]
          }
        },
        data: {
          status: "rejected"
        }
      })
    ]);

    await tx.notification.create({
      data: {
        userId: order.userId,
        type: "order",
        channel: "in_app",
        title:
          candidate.status === "pending_payment"
            ? "คำสั่งซื้อหมดเวลาชำระเงิน"
            : "คำสั่งซื้อหมดเวลาตรวจสอบการชำระเงิน",
        body:
          candidate.status === "pending_payment"
            ? "ระบบยกเลิกคำสั่งซื้อที่ยังไม่ได้ชำระภายใน 30 นาทีและคืนสต็อกแล้ว กรุณาสร้างคำสั่งซื้อใหม่หากยังต้องการสินค้า"
            : "ระบบยกเลิกคำสั่งซื้อที่ไม่สามารถตรวจสอบการชำระเงินให้เสร็จภายใน 24 ชั่วโมงและคืนสต็อกแล้ว กรุณาติดต่อเจ้าหน้าที่หากได้ชำระเงินแล้ว",
        metadataJson: {
          orderId: order.id,
          href: "/store/orders",
          reason:
            candidate.status === "pending_payment"
              ? "payment_reservation_expired"
              : "payment_review_reservation_expired"
        }
      }
    });

    await writeAuditLog(tx, {
      actorId: null,
      action: "order.payment_reservation_expired",
      entityType: "order",
      entityId: order.id,
      metadata: {
        previousStatus: candidate.status,
        nextStatus: "cancelled",
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        cutoff: cutoff.toISOString(),
        releasedInventory: Object.fromEntries(quantities),
        cancelledShipments: cancelledShipments.count,
        rejectedPayments: rejectedPayments.count,
        paymentVerificationPayloadPreserved: true
      }
    });

    return true;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  });
}

export async function releaseExpiredStoreOrderReservations(
  input: ReleaseExpiredStoreOrderReservationsInput = {}
): Promise<StoreReservationReleaseResult> {
  const now = input.now ?? new Date();
  const pendingPaymentCutoff = new Date(now.getTime() - STORE_RESERVATION_TTL_MS);
  const paymentReviewCutoff = new Date(now.getTime() - STORE_PAYMENT_REVIEW_TTL_MS);
  const candidates = await prisma.order.findMany({
    where: {
      userId: input.userId,
      OR: [
        {
          status: "pending_payment",
          createdAt: {
            lte: pendingPaymentCutoff
          }
        },
        {
          status: "payment_review",
          createdAt: {
            lte: paymentReviewCutoff
          }
        }
      ]
    },
    orderBy: {
      createdAt: "asc"
    },
    take: STORE_RESERVATION_CLEANUP_BATCH_SIZE,
    select: {
      id: true,
      status: true
    }
  });

  let released = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (candidate.status !== "pending_payment" && candidate.status !== "payment_review") {
      skipped += 1;
      continue;
    }

    const releasableCandidate: StoreReservationReleaseCandidate = {
      id: candidate.id,
      status: candidate.status
    };

    try {
      const cutoff =
        releasableCandidate.status === "pending_payment"
          ? pendingPaymentCutoff
          : paymentReviewCutoff;

      if (await releaseExpiredStoreOrderReservation(releasableCandidate, cutoff)) {
        released += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      if (!isExpectedReleaseConflict(error)) {
        throw error;
      }

      skipped += 1;
    }
  }

  return {
    candidates: candidates.length,
    released,
    skipped
  };
}
