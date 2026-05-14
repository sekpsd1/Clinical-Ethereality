"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePharmacistSession } from "@/lib/auth/guards";
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
      await applyOrderFulfillmentTransition(tx, {
        orderId: parsed.data.orderId,
        action: parsed.data.action,
        actorId: session.userId,
        auditMetadata: {
          surface: "pharmacist"
        }
      });
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
