"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { actionError, actionSuccess, formDataToObject, type FormActionState } from "@/lib/actions/server-actions";
import { setDefaultShippingAddressSchema, shippingAddressFormSchema } from "@/features/profile/shipping-addresses/schema";

export type ShippingAddressActionState = FormActionState;

async function lockCustomer(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT \`id\` FROM \`User\` WHERE \`id\` = ${userId} FOR UPDATE
  `);
  if (rows.length !== 1) throw new Error("USER_NOT_FOUND");
}

function revalidateShippingPaths() {
  revalidatePath("/profile/shipping-addresses");
  revalidatePath("/store/checkout");
  revalidatePath("/consult/prescriptions");
  revalidatePath("/store");
}

export async function saveShippingAddressAction(
  _previousState: ShippingAddressActionState,
  formData: FormData
): Promise<ShippingAddressActionState> {
  const session = await requireCurrentSession();
  assertPermission(session, "profile:update:self");
  const parsed = shippingAddressFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return actionError(parsed.error.issues[0]?.message ?? "ข้อมูลที่อยู่ไม่ถูกต้อง", parsed.error);

  try {
    const addressId = await prisma.$transaction(async (tx) => {
      await lockCustomer(tx, session.userId);
      const existing = parsed.data.addressId
        ? await tx.shippingAddress.findFirst({ where: { id: parsed.data.addressId, userId: session.userId } })
        : null;
      if (parsed.data.addressId && !existing) throw new Error("ADDRESS_NOT_FOUND");

      const currentDefault = await tx.shippingAddress.findFirst({ where: { userId: session.userId, isDefault: true }, select: { id: true } });
      const shouldBeDefault = !currentDefault || parsed.data.isDefault || existing?.isDefault === true;
      if (shouldBeDefault) {
        await tx.shippingAddress.updateMany({ where: { userId: session.userId }, data: { isDefault: false } });
      }

      const data = {
        label: parsed.data.label,
        recipientName: parsed.data.recipientName,
        phone: parsed.data.phone,
        addressLine1: parsed.data.addressLine1,
        addressLine2: parsed.data.addressLine2 ?? null,
        subdistrict: parsed.data.subdistrict,
        district: parsed.data.district,
        province: parsed.data.province,
        postalCode: parsed.data.postalCode,
        isDefault: shouldBeDefault
      };
      const saved = existing
        ? await tx.shippingAddress.update({ where: { id: existing.id }, data })
        : await tx.shippingAddress.create({ data: { userId: session.userId, ...data } });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: existing ? "shipping_address.update" : "shipping_address.create",
        entityType: "shipping_address",
        entityId: saved.id,
        metadata: { isDefault: saved.isDefault }
      });
      return saved.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    revalidateShippingPaths();
    return actionSuccess(parsed.data.addressId === addressId ? "แก้ไขที่อยู่แล้ว" : "เพิ่มที่อยู่แล้ว");
  } catch {
    return actionError("ยังบันทึกที่อยู่ไม่ได้ กรุณาลองใหม่อีกครั้ง");
  }
}

export async function setDefaultShippingAddressAction(formData: FormData): Promise<void> {
  const session = await requireCurrentSession();
  assertPermission(session, "profile:update:self");
  const parsed = setDefaultShippingAddressSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return;

  await prisma.$transaction(async (tx) => {
    await lockCustomer(tx, session.userId);
    const owned = await tx.shippingAddress.findFirst({ where: { id: parsed.data.addressId, userId: session.userId } });
    if (!owned) throw new Error("ADDRESS_NOT_FOUND");
    await tx.shippingAddress.updateMany({ where: { userId: session.userId }, data: { isDefault: false } });
    await tx.shippingAddress.update({ where: { id: owned.id }, data: { isDefault: true } });
    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "shipping_address.set_default",
      entityType: "shipping_address",
      entityId: owned.id
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidateShippingPaths();
}
