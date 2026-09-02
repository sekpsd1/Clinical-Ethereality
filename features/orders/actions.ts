"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentSession } from "@/lib/auth/session";
import { assertPermission, assertRole } from "@/lib/permissions";
import type { PublicSession } from "@/lib/auth/types";
import { actionError, actionSuccess, formDataToObject, type FormActionState } from "@/lib/actions/server-actions";
import { cancelCustomerOrderSchema } from "@/features/orders/schema";
import { cancelCustomerPendingStoreOrder } from "@/features/orders/reservations";

export type CustomerOrderCancellationActionState = FormActionState;

export async function cancelCustomerOrderAction(
  _previousState: CustomerOrderCancellationActionState,
  formData: FormData
): Promise<CustomerOrderCancellationActionState> {
  let session: PublicSession;

  try {
    session = await requireCurrentSession();
    assertRole(session, ["customer"]);
    assertPermission(session, "order:read:self");
  } catch {
    return actionError("ยกเลิกคำสั่งซื้อได้จากบัญชีลูกค้าเจ้าของรายการเท่านั้น");
  }

  const parsed = cancelCustomerOrderSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return actionError("คำขอยกเลิกคำสั่งซื้อไม่ถูกต้อง", parsed.error);
  }

  try {
    const result = await cancelCustomerPendingStoreOrder({
      orderId: parsed.data.orderId,
      userId: session.userId
    });

    if (result === "not_found") {
      return actionError("ไม่พบคำสั่งซื้อที่คุณมีสิทธิ์ยกเลิก");
    }

    if (result === "blocked") {
      return actionError("ยกเลิกได้เฉพาะคำสั่งซื้อที่ยังรอชำระเงินและยังไม่มีการชำระเงินสำเร็จ");
    }

    revalidatePath(`/store/orders/${parsed.data.orderId}`);
    revalidatePath("/store/orders");
    revalidatePath("/store");
    revalidatePath("/admin");
    revalidatePath("/admin/orders");
    revalidatePath("/admin/payments");
    revalidatePath("/pharmacist/orders");
    revalidatePath("/notifications");

    return actionSuccess(
      result === "cancelled"
        ? "ยกเลิกคำสั่งซื้อและคืนสต็อกที่สำรองไว้แล้ว"
        : "คำสั่งซื้อนี้ถูกยกเลิกแล้ว"
    );
  } catch {
    return actionError("ยังยกเลิกคำสั่งซื้อไม่ได้ กรุณาโหลดสถานะล่าสุดแล้วลองอีกครั้ง");
  }
}
