"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { reviewPaymentSchema } from "@/features/admin/payments/schema";

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

  const reviewedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: {
          id: parsed.data.paymentId
        },
        select: {
          id: true,
          orderId: true,
          status: true
        }
      });

      if (!payment) {
        throw new Error("Payment not found.");
      }

      if (payment.status !== "pending_review") {
        throw new Error("Payment has already been reviewed.");
      }

      await tx.payment.update({
        where: {
          id: payment.id
        },
        data: {
          status: parsed.data.status,
          reviewedById: session.userId,
          reviewedAt,
          verificationPayload: {
            reviewedAt: reviewedAt.toISOString(),
            reviewedBy: session.userId,
            source: "admin_manual_review"
          }
        }
      });

      await tx.order.update({
        where: {
          id: payment.orderId
        },
        data: {
          status: parsed.data.status === "verified" ? "preparing" : "pending_payment"
        }
      });

      await writeAuditLog(tx, {
        actorId: session.userId,
        action: "payment.manual_review",
        entityType: "payment",
        entityId: payment.id,
        metadata: {
          orderId: payment.orderId,
          status: parsed.data.status
        }
      });
    });
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
