"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { updateOrderFulfillmentSchema } from "@/features/admin/orders/schema";

export type AdminOrderActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function updateOrderFulfillmentAction(
  _previousState: AdminOrderActionState,
  formData: FormData
): Promise<AdminOrderActionState> {
  const session = await requireAdminSession();
  const parsed = updateOrderFulfillmentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขออัปเดตคำสั่งซื้อไม่ถูกต้อง"
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
      }
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถอัปเดตคำสั่งซื้อได้ กรุณาตรวจสอบสถานะแล้วลองใหม่"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");

  return {
    status: "success",
    message: "อัปเดตสถานะคำสั่งซื้อแล้ว"
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
