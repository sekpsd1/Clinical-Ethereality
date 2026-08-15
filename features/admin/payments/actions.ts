"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { manualStoreRefundSchema, reviewPaymentSchema } from "@/features/admin/payments/schema";
import { applyManualPaymentReview } from "@/features/payments/service";
import { applyManualStoreRefund } from "@/features/payments/refunds";
import { getManualStoreRefundReadiness } from "@/features/payments/refund-readiness";

export type AdminPaymentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function reviewPaymentAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  const parsed = reviewPaymentSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "คำขอตรวจสอบสลิปไม่ถูกต้อง"
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await applyManualPaymentReview(tx, {
          paymentId: parsed.data.paymentId,
          status: parsed.data.status,
          actorId: session.userId,
          transactionReference: parsed.data.transactionReference
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกผลตรวจสอบสลิปได้ กรุณาลองใหม่"
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/payments");

  return {
    status: "success",
    message: parsed.data.status === "verified" ? "ยืนยันการชำระเงินแล้ว" : "ปฏิเสธสลิปและส่งกลับไปชำระใหม่แล้ว"
  };
}

export async function refundStorePaymentAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  const readiness = await getManualStoreRefundReadiness();

  if (readiness.status !== "ready") {
    return {
      status: "error",
      message: readiness.message
    };
  }

  const parsed = manualStoreRefundSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรอกข้อมูลการคืนเงินให้ครบ และยืนยันว่าโอนเงินภายนอกสำเร็จแล้ว"
    };
  }

  try {
    const outcome = await prisma.$transaction(
      (tx) =>
        applyManualStoreRefund(tx, {
          actorId: session.userId,
          paymentId: parsed.data.paymentId,
          refundAmount: parsed.data.refundAmount,
          refundReason: parsed.data.refundReason,
          refundTransactionReference: parsed.data.refundTransactionReference
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      }
    );

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/orders");
    revalidatePath("/store/orders");

    return {
      status: "success",
      message: outcome === "already_refunded" ? "รายการนี้คืนเงินแล้ว" : "บันทึกการคืนเงินเต็มจำนวนแล้ว"
    };
  } catch {
    return {
      status: "error",
      message: "ไม่สามารถบันทึกการคืนเงินได้ โปรดตรวจสถานะคำสั่งซื้อและข้อมูลที่กรอก"
    };
  }
}
