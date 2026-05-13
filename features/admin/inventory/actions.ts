"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { updateInventorySchema } from "@/features/admin/inventory/schema";

export type AdminInventoryActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function updateInventoryAction(
  _previousState: AdminInventoryActionState,
  formData: FormData
): Promise<AdminInventoryActionState> {
  const session = await requireAdminSession();
  const parsed = updateInventorySchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "ข้อมูลสต็อกไม่ถูกต้อง"
    };
  }

  try {
    const inventory = await prisma.inventory.findUnique({
      where: {
        id: parsed.data.inventoryId
      },
      select: {
        reservedQuantity: true
      }
    });

    if (!inventory) {
      return {
        status: "error",
        message: "ไม่พบรายการสต็อกนี้"
      };
    }

    if (parsed.data.quantity < inventory.reservedQuantity) {
      return {
        status: "error",
        message: "จำนวนคงคลังต้องไม่น้อยกว่าจำนวนที่ถูกจองไว้"
      };
    }

    await prisma.inventory.update({
      where: {
        id: parsed.data.inventoryId
      },
      data: {
        quantity: parsed.data.quantity,
        lowStockThreshold: parsed.data.lowStockThreshold,
        updatedById: session.userId
      }
    });
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถอัปเดตสต็อกได้ กรุณาลองใหม่"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/inventory");

  return {
    status: "success",
    message: "อัปเดตสต็อกเรียบร้อยแล้ว"
  };
}
