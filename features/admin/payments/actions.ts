"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAdminSession } from "@/lib/auth/guards";
import { assertPermission } from "@/lib/permissions";
import {
  manualConsultationPaymentReviewSchema,
  manualStoreRefundSchema,
  reviewPaymentSchema
} from "@/features/admin/payments/schema";
import { applyManualPaymentReview } from "@/features/payments/service";
import { applyManualStoreRefund } from "@/features/payments/refunds";
import { getManualStoreRefundReadiness } from "@/features/payments/refund-readiness";
import {
  applyManualConsultationPaymentReview,
  ConsultationManualReviewError
} from "@/features/consultations/payment/manual-review";

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

export async function reviewConsultationPaymentAction(
  _previousState: AdminPaymentActionState,
  formData: FormData
): Promise<AdminPaymentActionState> {
  const session = await requireAdminSession();
  assertPermission(session, "consultation-payment:manual-review");
  const parsed = manualConsultationPaymentReviewSchema.safeParse(
    formDataToObject(formData)
  );

  if (!parsed.success) {
    return {
      status: "error",
      message: "กรอกข้อมูลตรวจรายการโอนให้ครบและใช้วันที่เวลาประเทศไทย"
    };
  }

  try {
    const outcome = await prisma.$transaction(
      (tx) =>
        applyManualConsultationPaymentReview(tx, {
          actorId: session.userId,
          amount: parsed.data.amount,
          customerReportedAt: parsed.data.customerReportedAt,
          paymentId: parsed.data.paymentId,
          reasonCode: parsed.data.reasonCode,
          transactionReference: parsed.data.transactionReference,
          transferredAt: parsed.data.transferredAt
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    revalidatePath("/doctor/consultations");
    revalidatePath("/doctor/notifications");
    revalidatePath("/notifications");

    return {
      status: "success",
      message:
        outcome === "already_processed"
          ? "รายการนี้ยืนยันไว้แล้ว"
          : outcome === "scheduled"
            ? "ยืนยันการชำระเงินและนัดหมายแล้ว"
            : "ยืนยันการชำระเงินแล้ว ลูกค้าต้องเลือกเวลาใหม่"
    };
  } catch (error) {
    const messages: Partial<
      Record<ConsultationManualReviewError["code"], string>
    > = {
      DUPLICATE_REFERENCE: "เลขอ้างอิงนี้ถูกใช้กับรายการที่ยืนยันแล้ว",
      INVALID_AMOUNT: "ยอดที่กรอกไม่ตรงกับยอดค่าปรึกษา",
      INVALID_CONTACT_WINDOW: "ลูกค้าต้องติดต่อ LINE OA ภายใน 24 ชั่วโมงหลังระบบตรวจสลิปล้มเหลว",
      INVALID_TRANSFER_TIME: "วันเวลาโอนไม่อยู่ในช่วงที่อนุญาต",
      MISSING_EVIDENCE: "ไม่พบสลิปส่วนตัวที่เชื่อมกับรายการนี้",
      NOT_ELIGIBLE: "รายการนี้ไม่เข้าเงื่อนไข Manual Consultation Payment Review",
      CONFLICT: "สถานะรายการเปลี่ยนแล้ว กรุณารีเฟรชก่อนตรวจใหม่"
    };
    return {
      status: "error",
      message:
        error instanceof ConsultationManualReviewError
          ? messages[error.code] ?? "ไม่สามารถยืนยันรายการนี้ได้"
          : "ไม่สามารถยืนยันรายการนี้ได้ กรุณาตรวจสถานะแล้วลองใหม่"
    };
  }
}
