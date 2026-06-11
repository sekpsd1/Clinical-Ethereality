import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";

export type ManualPaymentReviewStatus = "verified" | "rejected";

export type ManualPaymentReviewTransition = {
  paymentStatus: ManualPaymentReviewStatus;
  orderStatus: OrderStatus;
  notificationTitle: string;
  notificationBody: string;
};

const manualPaymentReviewTransitions: Record<ManualPaymentReviewStatus, ManualPaymentReviewTransition> = {
  verified: {
    paymentStatus: "verified",
    orderStatus: "preparing",
    notificationTitle: "ยืนยันการชำระเงินแล้ว",
    notificationBody: "แอดมินตรวจสอบสลิปและยืนยันการชำระเงินของคุณแล้ว"
  },
  rejected: {
    paymentStatus: "rejected",
    orderStatus: "pending_payment",
    notificationTitle: "สลิปไม่ผ่านการตรวจสอบ",
    notificationBody: "กรุณาตรวจสอบสลิปและส่งใหม่อีกครั้ง"
  }
};

export function getManualPaymentReviewTransition(status: ManualPaymentReviewStatus): ManualPaymentReviewTransition {
  return manualPaymentReviewTransitions[status];
}

export function assertPaymentReadyForManualReview(currentStatus: PaymentStatus) {
  if (currentStatus !== "pending_review") {
    throw new Error("Payment has already been reviewed.");
  }
}

export async function applyManualPaymentReview(
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string;
    status: ManualPaymentReviewStatus;
    actorId: string;
  }
) {
  const reviewedAt = new Date();
  const payment = await tx.payment.findUnique({
    where: {
      id: input.paymentId
    },
    select: {
      id: true,
      orderId: true,
      status: true,
      order: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!payment) {
    throw new Error("Payment not found.");
  }

  assertPaymentReadyForManualReview(payment.status);

  const transition = getManualPaymentReviewTransition(input.status);

  await tx.payment.update({
    where: {
      id: payment.id
    },
    data: {
      status: transition.paymentStatus,
      reviewedById: input.actorId,
      reviewedAt,
      verificationPayload: {
        reviewedAt: reviewedAt.toISOString(),
        reviewedBy: input.actorId,
        source: "admin_manual_review",
        previousStatus: payment.status,
        nextStatus: transition.paymentStatus
      }
    }
  });

  await tx.order.update({
    where: {
      id: payment.orderId
    },
    data: {
      status: transition.orderStatus
    }
  });

  await tx.notification.create({
    data: {
      userId: payment.order.userId,
      type: "payment",
      channel: "in_app",
      title: transition.notificationTitle,
      body: transition.notificationBody,
      metadataJson: {
        paymentId: payment.id,
        orderId: payment.orderId,
        href: "/store/orders"
      }
    }
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "payment.manual_review",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      orderId: payment.orderId,
      previousStatus: payment.status,
      nextStatus: transition.paymentStatus,
      orderStatus: transition.orderStatus
    }
  });
}
