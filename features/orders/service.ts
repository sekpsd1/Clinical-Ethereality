import type { OrderStatus, Prisma, ShipmentStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";

export type OrderFulfillmentAction = "mark_preparing" | "mark_shipped" | "mark_delivered";

type OrderFulfillmentTransition = {
  from: OrderStatus;
  to: OrderStatus;
  shipmentStatus: ShipmentStatus;
  auditAction: string;
};

const orderFulfillmentTransitions: Record<OrderFulfillmentAction, OrderFulfillmentTransition> = {
  mark_preparing: {
    from: "paid",
    to: "preparing",
    shipmentStatus: "preparing",
    auditAction: "order.mark_preparing"
  },
  mark_shipped: {
    from: "preparing",
    to: "shipped",
    shipmentStatus: "shipped",
    auditAction: "order.mark_shipped"
  },
  mark_delivered: {
    from: "shipped",
    to: "delivered",
    shipmentStatus: "delivered",
    auditAction: "order.mark_delivered"
  }
};

export function getOrderFulfillmentTransition(action: OrderFulfillmentAction): OrderFulfillmentTransition {
  return orderFulfillmentTransitions[action];
}

export function assertOrderFulfillmentTransition(currentStatus: OrderStatus, action: OrderFulfillmentAction) {
  const transition = getOrderFulfillmentTransition(action);

  if (currentStatus !== transition.from) {
    throw new Error(`Order must be ${transition.from} before it can move to ${transition.to}.`);
  }

  return transition;
}

export async function applyOrderFulfillmentTransition(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    action: OrderFulfillmentAction;
    actorId: string;
    auditMetadata?: Record<string, string>;
  }
) {
  const order = await tx.order.findUnique({
    where: {
      id: input.orderId
    },
    select: {
      id: true,
      status: true,
      shipments: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 1,
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    throw new Error("Order not found.");
  }

  const transition = assertOrderFulfillmentTransition(order.status, input.action);

  await tx.order.update({
    where: {
      id: order.id
    },
    data: {
      status: transition.to
    }
  });

  await upsertLatestShipment(tx, order.id, order.shipments[0]?.id, {
    status: transition.shipmentStatus,
    updatedById: input.actorId
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: transition.auditAction,
    entityType: "order",
    entityId: order.id,
    metadata: {
      previousStatus: order.status,
      nextStatus: transition.to,
      ...input.auditMetadata
    }
  });
}

async function upsertLatestShipment(
  tx: Prisma.TransactionClient,
  orderId: string,
  shipmentId: string | undefined,
  data: {
    status: ShipmentStatus;
    updatedById: string;
  }
) {
  if (shipmentId) {
    await tx.shipmentTracking.update({
      where: {
        id: shipmentId
      },
      data
    });
    return;
  }

  await tx.shipmentTracking.create({
    data: {
      orderId,
      ...data
    }
  });
}
