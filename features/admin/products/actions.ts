"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { actionError, actionSuccess, formDataToObject, type FormActionState } from "@/lib/actions/server-actions";
import { archiveProductSchema, upsertProductSchema } from "@/features/admin/products/schema";

export type AdminProductActionState = FormActionState;

export async function upsertProductAction(
  _previousState: AdminProductActionState,
  formData: FormData
): Promise<AdminProductActionState> {
  const session = await requireAdminSession();
  const parsed = upsertProductSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return actionError("รายละเอียดสินค้าไม่ถูกต้อง กรุณาตรวจ slug ชื่อสินค้า และราคา", parsed.error);
  }

  const { productId, ...productData } = parsed.data;
  const normalizedData = {
    ...productData,
    shortDescription: productData.shortDescription || null,
    description: productData.description || null,
    usageInstructions: productData.usageInstructions || null,
    fdaNumber: productData.fdaNumber || null,
    warnings: productData.warnings || null,
    storageInstructions: productData.storageInstructions || null,
    specialFulfillmentNotes: productData.specialFulfillmentNotes || null,
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
            category: normalizedData.category,
            status: normalizedData.status,
            requiresPrescription: normalizedData.requiresPrescription,
            controlledOrRestricted: normalizedData.controlledOrRestricted
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
            category: product.category,
            status: product.status,
            requiresPrescription: product.requiresPrescription,
            controlledOrRestricted: product.controlledOrRestricted
          }
        });
      }
    });
  } catch {
    return actionError("ยังบันทึกสินค้าไม่ได้ กรุณาตรวจ slug ซ้ำแล้วลองอีกครั้ง");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");

  return actionSuccess(productId ? "อัปเดตสินค้าแล้ว" : "สร้างสินค้าแล้ว");
}

export async function archiveProductAction(
  _previousState: AdminProductActionState,
  formData: FormData
): Promise<AdminProductActionState> {
  const session = await requireAdminSession();
  const parsed = archiveProductSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return actionError("ไม่พบสินค้าที่ต้องการเก็บถาวร", parsed.error);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: parsed.data.productId },
        select: { id: true, slug: true, status: true }
      });

      if (!product) {
        throw new Error("Product not found");
      }

      if (product.status === "archived") {
        return;
      }

      await tx.product.update({
        where: { id: product.id },
        data: { status: "archived" }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "product.archive",
        entityType: "product",
        entityId: product.id,
        metadata: {
          slug: product.slug,
          previousStatus: product.status,
          status: "archived"
        }
      });
    });
  } catch {
    return actionError("ยังเก็บสินค้าถาวรไม่ได้ กรุณาลองอีกครั้ง");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/store");

  return actionSuccess("เก็บสินค้าถาวรแล้ว");
}
