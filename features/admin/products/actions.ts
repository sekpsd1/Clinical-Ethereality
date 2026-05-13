"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
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
  const session = await requireAdminSession();
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
    await prisma.$transaction(async (tx) => {
      if (productId) {
        await tx.product.update({
          where: {
            id: productId
          },
          data: normalizedData
        });

        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "product.update",
          entityType: "product",
          entityId: productId,
          metadata: {
            slug: normalizedData.slug,
            status: normalizedData.status,
            requiresPrescription: normalizedData.requiresPrescription
          }
        });
      } else {
        const product = await tx.product.create({
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

        await writeAuditLog(tx, {
          actorId: session.userId,
          action: "product.create",
          entityType: "product",
          entityId: product.id,
          metadata: {
            slug: product.slug,
            status: product.status,
            requiresPrescription: product.requiresPrescription
          }
        });
      }
    });
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
