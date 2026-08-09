"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { reviewPaymentSchema } from "@/features/admin/payments/schema";
import { applyManualPaymentReview } from "@/features/payments/service";

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
