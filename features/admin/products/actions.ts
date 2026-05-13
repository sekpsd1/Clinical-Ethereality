"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { upsertProductSchema } from "@/features/admin/products/schema";

export type AdminProductActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function upsertProductAction(
  _previousState: AdminProductActionState,
  formData: FormData
): Promise<AdminProductActionState> {
  await requireAdminSession();
  const parsed = upsertProductSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Product details are invalid. Check slug, name, and price."
    };
  }

  const { productId, ...productData } = parsed.data;
  const normalizedData = {
    ...productData,
    description: productData.description || null,
    imageUrl: productData.imageUrl || null,
    price: productData.price.toFixed(2)
  };

  try {
    if (productId) {
      await prisma.product.update({
        where: {
          id: productId
        },
        data: normalizedData
      });
    } else {
      await prisma.product.create({
        data: {
          ...normalizedData,
          inventory: {
            create: {
              quantity: 0,
              reservedQuantity: 0,
              lowStockThreshold: 0
            }
          }
        }
      });
    }
  } catch {
    return {
      status: "error",
      message: "Product could not be saved. Check for duplicate slug and try again."
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");

  return {
    status: "success",
    message: productId ? "Product updated." : "Product created."
  };
}
