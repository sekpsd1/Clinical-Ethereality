import { Prisma, type OrderStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { reverseOrderRewardPoints } from "@/features/rewards/rules";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";

const refundableOrderStatuses: OrderStatus[] = ["paid", "preparing"];

export class ManualStoreRefundEligibilityError extends Error {
  constructor(message = "This Store order is not eligible for a manual refund.") {
    super(message);
    this.name = "ManualStoreRefundEligibilityError";
  }
}

export class DuplicateRefundReferenceError extends Error {
  constructor() {
    super("This refund bank reference has already been used.");
    this.name = "DuplicateRefundReferenceError";
  }
}

export class ManualStoreRefundConflictError extends Error {
  constructor() {
    super("The order changed before the refund could be recorded.");
    this.name = "ManualStoreRefundConflictError";
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}

function assertFullRefundAmount(amount: Prisma.Decimal, refundAmount: string): Prisma.Decimal {
  let parsedAmount: Prisma.Decimal;

  try {
    parsedAmount = new Prisma.Decimal(refundAmount);
  } catch {
    throw new ManualStoreRefundEligibilityError("Refund amount is invalid.");
  }

  if (!parsedAmount.isPositive() || !parsedAmount.equals(amount)) {
    throw new ManualStoreRefundEligibilityError("Only the exact full payment amount can be refunded.");
  }

  return parsedAmount;
}

export async function applyManualStoreRefund(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    paymentId: string;
    refundAmount: string;
    refundReason: string;
    refundTransactionReference: string;
  }
): Promise<"refunded" | "already_refunded"> {
  const initialPayment = await tx.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      orderId: true
    }
  });

  if (!initialPayment?.orderId) {
    throw new ManualStoreRefundEligibilityError("Consultation payments cannot use the Store refund workflow.");
  }

  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Order\` WHERE \`id\` = ${initialPayment.orderId} FOR UPDATE`
  );

  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      amount: true,
      orderId: true,
      status: true,
      normalizedTransactionReference: true,
      order: {
        select: {
          id: true,
          userId: true,
          status: true,
          items: {
            select: {
              productId: true,
              quantity: true
            }
          },
          shipments: {
            select: {
              status: true
            }
          }
        }
      }
    }
  });

  if (!payment?.orderId || !payment.order) {
    throw new ManualStoreRefundEligibilityError("Store payment was not found.");
  }

  if (payment.status === "refunded" && payment.order.status === "refunded") {
    return "already_refunded";
  }

  if (payment.status !== "verified" || !refundableOrderStatuses.includes(payment.order.status)) {
    throw new ManualStoreRefundEligibilityError();
  }

  if (payment.order.shipments.some((shipment) => shipment.status === "shipped" || shipment.status === "delivered")) {
    throw new ManualStoreRefundEligibilityError("Shipped or delivered Store orders cannot be refunded through this workflow.");
  }

  const refundAmount = assertFullRefundAmount(payment.amount, input.refundAmount);
  const refundTransactionReference = input.refundTransactionReference.trim();
  const normalizedRefundReference = normalizePaymentTransactionReference(refundTransactionReference);
  const refundReason = input.refundReason.trim();

  if (!refundReason) {
    throw new ManualStoreRefundEligibilityError("A refund reason is required.");
  }

  const duplicate = await tx.payment.findFirst({
    where: {
      id: {
        not: payment.id
      },
      normalizedRefundReference
    },
    select: { id: true }
  });

  if (duplicate) {
    throw new DuplicateRefundReferenceError();
  }

  let paymentUpdate: { count: number };

  try {
    paymentUpdate = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: "verified"
      },
      data: {
        status: "refunded",
        refundTransactionReference,
        normalizedRefundReference,
        refundAmount,
        refundReason,
        refundedAt: new Date(),
        refundedById: input.actorId
      }
    });
  } catch (error) {
    if (isUniqueConstraint(error)) {
      throw new DuplicateRefundReferenceError();
    }

    throw error;
  }

  if (paymentUpdate.count !== 1) {
    throw new ManualStoreRefundConflictError();
  }

  const orderUpdate = await tx.order.updateMany({
    where: {
      id: payment.order.id,
      status: {
        in: refundableOrderStatuses
      }
    },
    data: {
      status: "refunded"
    }
  });

  if (orderUpdate.count !== 1) {
    throw new ManualStoreRefundConflictError();
  }

  await tx.shipmentTracking.updateMany({
    where: {
      orderId: payment.order.id,
      status: {
        notIn: ["shipped", "delivered"]
      }
    },
    data: {
      status: "cancelled",
      updatedById: input.actorId
    }
  });

  const quantitiesByProduct = payment.order.items.reduce((quantities, item) => {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    return quantities;
  }, new Map<string, number>());

  for (const [productId, quantity] of quantitiesByProduct) {
    const inventoryUpdate = await tx.inventory.updateMany({
      where: { productId },
      data: {
        quantity: {
          increment: quantity
        }
      }
    });

    if (inventoryUpdate.count !== 1) {
      throw new ManualStoreRefundConflictError();
    }
  }

  const reversedRewardPoints = await reverseOrderRewardPoints(tx, {
    userId: payment.order.userId,
    orderId: payment.order.id
  });

  await tx.notification.create({
    data: {
      userId: payment.order.userId,
      type: "payment",
      channel: "in_app",
      title: "คืนเงินคำสั่งซื้อแล้ว",
      body: "แอดมินบันทึกการคืนเงินเต็มจำนวนสำหรับคำสั่งซื้อของคุณแล้ว",
      metadataJson: {
        paymentId: payment.id,
        orderId: payment.order.id,
        href: "/store/orders"
      }
    }
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "payment.manual_store_refund",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      orderId: payment.order.id,
      previousPaymentStatus: "verified",
      nextPaymentStatus: "refunded",
      previousOrderStatus: payment.order.status,
      nextOrderStatus: "refunded",
      refundAmount: refundAmount.toString(),
      refundReasonProvided: true,
      refundReferenceRecorded: true,
      reversedRewardPoints
    }
  });

  return "refunded";
}
