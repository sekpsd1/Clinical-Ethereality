"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePharmacistSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { updatePharmacistOrderSchema } from "@/features/pharmacist/orders/schema";

export type PharmacistOrderActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function updatePharmacistOrderAction(
  _previousState: PharmacistOrderActionState,
  formData: FormData
): Promise<PharmacistOrderActionState> {
  const session = await requirePharmacistSession();
  const parsed = updatePharmacistOrderSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Order update request is invalid."
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: {
          id: parsed.data.orderId
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

      if (parsed.data.action === "mark_preparing") {
        if (order.status !== "paid") {
          throw new Error("Order is not ready for preparation.");
        }

        await tx.order.update({
          where: {
            id: order.id
          },
          data: {
            status: "preparing"
          }
        });

        await upsertLatestShipment(tx, order.id, order.shipments[0]?.id, {
          status: "preparing",
          updatedById: session.userId
        });

        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "order.mark_preparing",
          entityType: "order",
          entityId: order.id,
          metadata: {
            previousStatus: order.status,
            nextStatus: "preparing",
            surface: "pharmacist"
          }
        });
      }

      if (parsed.data.action === "mark_shipped") {
        if (order.status !== "preparing") {
          throw new Error("Order is not ready to ship.");
        }

        await tx.order.update({
          where: {
            id: order.id
          },
          data: {
            status: "shipped"
          }
        });

        await upsertLatestShipment(tx, order.id, order.shipments[0]?.id, {
          status: "shipped",
          updatedById: session.userId
        });

        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "order.mark_shipped",
          entityType: "order",
          entityId: order.id,
          metadata: {
            previousStatus: order.status,
            nextStatus: "shipped",
            surface: "pharmacist"
          }
        });
      }

      if (parsed.data.action === "mark_delivered") {
        if (order.status !== "shipped") {
          throw new Error("Order is not ready to deliver.");
        }

        await tx.order.update({
          where: {
            id: order.id
          },
          data: {
            status: "delivered"
          }
        });

        await upsertLatestShipment(tx, order.id, order.shipments[0]?.id, {
          status: "delivered",
          updatedById: session.userId
        });

        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "order.mark_delivered",
          entityType: "order",
          entityId: order.id,
          metadata: {
            previousStatus: order.status,
            nextStatus: "delivered",
            surface: "pharmacist"
          }
        });
      }
    });
  } catch {
    return {
      status: "error",
      message: "Order status could not be updated. Check the current status and try again."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/pharmacist/orders");

  return {
    status: "success",
    message: "Order status updated."
  };
}

async function upsertLatestShipment(
  tx: Prisma.TransactionClient,
  orderId: string,
  shipmentId: string | undefined,
  data: {
    status: "preparing" | "shipped" | "delivered";
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
