import type { OrderStatus, PrescriptionStatus, Prisma, ShipmentStatus } from "@prisma/client";
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

export function shouldMarkPrescriptionDispensed(status: PrescriptionStatus): boolean {
  return status === "pending_verification" || status === "verified";
}

export function assertPrescriptionReadyForDispensing(status: PrescriptionStatus): void {
  if (!shouldMarkPrescriptionDispensed(status) && status !== "dispensed") {
    throw new Error("Linked prescription is not ready for dispensing.");
  }
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
      items: {
        select: {
          prescriptionId: true
        }
      },
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
  const prescriptionIds = Array.from(
    new Set(order.items.flatMap((item) => (item.prescriptionId ? [item.prescriptionId] : [])))
  );
  const linkedPrescriptions =
    input.action === "mark_shipped" && prescriptionIds.length > 0
      ? await tx.prescription.findMany({
          where: {
            id: {
              in: prescriptionIds
            }
          },
          select: {
            id: true,
            status: true
          }
        })
      : [];

  if (linkedPrescriptions.length !== prescriptionIds.length) {
    throw new Error("Linked prescription was not found.");
  }

  linkedPrescriptions.forEach((prescription) => {
    assertPrescriptionReadyForDispensing(prescription.status);
  });

  const orderUpdate = await tx.order.updateMany({
    where: {
      id: order.id,
      status: transition.from
    },
    data: {
      status: transition.to
    }
  });

  if (orderUpdate.count !== 1) {
    throw new Error("Order fulfillment status changed before this action completed.");
  }

  await upsertLatestShipment(tx, order.id, order.shipments[0]?.id, {
    status: transition.shipmentStatus,
    updatedById: input.actorId
  });

  for (const prescription of linkedPrescriptions) {
    if (!shouldMarkPrescriptionDispensed(prescription.status)) {
      continue;
    }

    const prescriptionUpdate = await tx.prescription.updateMany({
      where: {
        id: prescription.id,
        status: prescription.status
      },
      data: {
        status: "dispensed"
      }
    });

    if (prescriptionUpdate.count !== 1) {
      throw new Error("Prescription status changed before dispensing completed.");
    }

    await writeAuditLog(tx, {
      actorId: input.actorId,
      action: "prescription.dispensed",
      entityType: "prescription",
      entityId: prescription.id,
      metadata: {
        orderId: order.id,
        previousStatus: prescription.status,
        nextStatus: "dispensed",
        ...input.auditMetadata
      }
    });
  }

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
