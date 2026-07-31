"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { updatePharmacistOrderSchema } from "@/features/pharmacist/orders/schema";
import { applyOrderFulfillmentTransition } from "@/features/orders/service";

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
  const session = await requireAdminSession();
  const parsed = updatePharmacistOrderSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขออัปเดตออเดอร์ไม่ถูกต้อง"
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await applyOrderFulfillmentTransition(tx, {
        orderId: parsed.data.orderId,
        action: parsed.data.action,
        actorId: session.userId,
        auditMetadata: {
          actorRole: session.role,
          surface: "legacy_pharmacist"
        }
      });
    });
  } catch {
    return {
      status: "error",
      message: "อัปเดตสถานะออเดอร์ไม่ได้ โปรดตรวจสถานะล่าสุดแล้วลองอีกครั้ง"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/pharmacist/orders");

  return {
    status: "success",
    message: "อัปเดตสถานะออเดอร์แล้ว"
  };
}
