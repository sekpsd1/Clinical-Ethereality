"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { updateOrderFulfillmentSchema } from "@/features/admin/orders/schema";
import { applyOrderFulfillmentTransition } from "@/features/orders/service";

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
      await applyOrderFulfillmentTransition(tx, {
        orderId: parsed.data.orderId,
        action: parsed.data.action,
        actorId: session.userId
      });
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
