import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";
import { buildAttachmentMetadata, type NormalizedHostedAttachment } from "@/lib/storage/attachments";

export type ManualPaymentReviewStatus = "verified" | "rejected";

export type ManualPaymentReviewTransition = {
  paymentStatus: ManualPaymentReviewStatus;
  orderStatus: OrderStatus;
  notificationTitle: string;
  notificationBody: string;
};

export type ProviderPaymentVerificationTransition = {
  paymentStatus: "verified" | "rejected";
  orderStatus: OrderStatus;
  notificationTitle: string;
  notificationBody: string;
};

export type ProviderPaymentSnapshot = {
  id: string;
  orderId: string;
  orderUserId: string;
  status: PaymentStatus;
  slipImageUrl: string | null;
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

const providerPaymentVerificationTransitions: Record<"verified" | "rejected", ProviderPaymentVerificationTransition> = {
  verified: {
    paymentStatus: "verified",
    orderStatus: "paid",
    notificationTitle: "ตรวจสอบสลิปสำเร็จ",
    notificationBody: "ระบบยืนยันการชำระเงินของคุณแล้ว"
  },
  rejected: {
    paymentStatus: "rejected",
    orderStatus: "pending_payment",
    notificationTitle: "ตรวจสอบสลิปไม่ผ่าน",
    notificationBody: "กรุณาตรวจสอบสลิปและส่งใหม่อีกครั้ง"
  }
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export function getManualPaymentReviewTransition(status: ManualPaymentReviewStatus): ManualPaymentReviewTransition {
  return manualPaymentReviewTransitions[status];
}

export function getProviderPaymentVerificationTransition(ok: boolean): ProviderPaymentVerificationTransition {
  return providerPaymentVerificationTransitions[ok ? "verified" : "rejected"];
}

export function assertPaymentReadyForManualReview(currentStatus: PaymentStatus) {
  if (currentStatus !== "pending_review") {
    throw new Error("Payment has already been reviewed.");
  }
}

export function assertPaymentReadyForProviderVerification(currentStatus: PaymentStatus) {
  if (currentStatus !== "pending_review" && currentStatus !== "pending_slip") {
    throw new Error("Payment is not ready for slip verification.");
  }
}

export function getProviderSlipAttachmentCreateData(input: {
  hostedSlipAttachment: NormalizedHostedAttachment | null;
  orderId: string;
  ownerId: string;
  paymentId: string;
}) {
  if (!input.hostedSlipAttachment) {
    return null;
  }

  return {
    ownerId: input.ownerId,
    purpose: "payment_slip" as const,
    entityType: "payment",
    entityId: input.paymentId,
    storageUrl: input.hostedSlipAttachment.storageUrl,
    storageKey: input.hostedSlipAttachment.storageKey,
    fileName: input.hostedSlipAttachment.fileName,
    mimeType: input.hostedSlipAttachment.mimeType,
    byteSize: input.hostedSlipAttachment.byteSize,
    metadataJson: buildAttachmentMetadata(input.hostedSlipAttachment, {
      orderId: input.orderId,
      source: "payment_slip_verification"
    })
  };
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

  if (!payment.orderId || !payment.order) {
    throw new Error("Consultation payments cannot use the order review workflow.");
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

export async function applyProviderPaymentVerification(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    hostedSlipAttachment: NormalizedHostedAttachment | null;
    payment: ProviderPaymentSnapshot;
    result: SlipVerificationResult;
    source: "qr_payload" | "image_url";
  }
) {
  const reviewedAt = new Date();
  const transition = getProviderPaymentVerificationTransition(input.result.ok);

  assertPaymentReadyForProviderVerification(input.payment.status);

  await tx.payment.update({
    where: {
      id: input.payment.id
    },
    data: {
      status: transition.paymentStatus,
      slipImageUrl: input.hostedSlipAttachment?.storageUrl ?? input.payment.slipImageUrl,
      reviewedAt,
      verificationPayload: {
        reviewedAt: reviewedAt.toISOString(),
        source: input.result.provider,
        result: toJsonValue(input.result)
      }
    }
  });

  await tx.order.update({
    where: {
      id: input.payment.orderId
    },
    data: {
      status: transition.orderStatus
    }
  });

  await tx.notification.create({
    data: {
      userId: input.payment.orderUserId,
      type: "payment",
      channel: "in_app",
      title: transition.notificationTitle,
      body: transition.notificationBody,
      metadataJson: {
        paymentId: input.payment.id,
        orderId: input.payment.orderId,
        href: "/store/orders"
      }
    }
  });

  await createHostedSlipAttachmentIfNeeded(tx, {
    hostedSlipAttachment: input.hostedSlipAttachment,
    orderId: input.payment.orderId,
    ownerId: input.payment.orderUserId,
    paymentId: input.payment.id
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "payment.provider_verify_slip",
    entityType: "payment",
    entityId: input.payment.id,
    metadata: {
      orderId: input.payment.orderId,
      provider: input.result.provider,
      ok: input.result.ok,
      source: input.source
    }
  });
}

async function createHostedSlipAttachmentIfNeeded(
  tx: Prisma.TransactionClient,
  input: {
    hostedSlipAttachment: NormalizedHostedAttachment | null;
    orderId: string;
    ownerId: string;
    paymentId: string;
  }
) {
  const attachmentData = getProviderSlipAttachmentCreateData(input);

  if (!attachmentData) {
    return;
  }

  const existingAttachment = await tx.fileAttachment.findFirst({
    where: {
      purpose: "payment_slip",
      entityType: "payment",
      entityId: input.paymentId,
      storageUrl: attachmentData.storageUrl
    },
    select: {
      id: true
    }
  });

  if (existingAttachment) {
    return;
  }

  await tx.fileAttachment.create({
    data: attachmentData
  });
}
