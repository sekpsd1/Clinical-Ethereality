import type { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";
import { buildAttachmentMetadata, type NormalizedHostedAttachment } from "@/lib/storage/attachments";
import { awardRewardPoints, calculateOrderRewardPoints, getRewardExpiryDate } from "@/features/rewards/rules";
import { STORE_PAYMENT_REVIEW_TTL_MS } from "@/features/orders/reservations";

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
  amount: Prisma.Decimal;
  status: "pending_review";
  slipImageUrl: string | null;
  verificationPayload: Prisma.JsonValue | null;
  updatedAt: Date;
};

export const PAYMENT_RETRY_COOLDOWN_SECONDS = 30;

const paymentReadyOrderStatuses: OrderStatus[] = ["pending_payment", "payment_review"];
const completedPaymentStatuses: PaymentStatus[] = ["verified", "refunded"];

export class DuplicatePaymentTransactionError extends Error {
  constructor() {
    super("This bank transaction has already been used for another verified payment.");
    this.name = "DuplicatePaymentTransactionError";
  }
}

export class PaymentVerificationConflictError extends Error {
  constructor() {
    super("Payment status changed before verification could be saved.");
    this.name = "PaymentVerificationConflictError";
  }
}

export class PaymentVerificationRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(`Payment verification was claimed recently. Retry after ${retryAfterSeconds} seconds.`);
    this.name = "PaymentVerificationRateLimitError";
  }
}

export class CompletedOrderPaymentConflictError extends PaymentVerificationConflictError {
  constructor() {
    super();
    this.message = "This order already has another completed payment.";
    this.name = "CompletedOrderPaymentConflictError";
  }
}

export class InventoryFinalizationConflictError extends PaymentVerificationConflictError {
  constructor() {
    super();
    this.message = "Reserved inventory changed before payment verification could be finalized.";
    this.name = "InventoryFinalizationConflictError";
  }
}

export class ProviderVerificationUnavailableError extends Error {
  constructor() {
    super("Provider errors must not be persisted as rejected payments.");
    this.name = "ProviderVerificationUnavailableError";
  }
}

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

function toInputJsonObject(value: Prisma.JsonValue | null): Prisma.InputJsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return toJsonValue(value) as Prisma.InputJsonObject;
}

export function mergePaymentVerificationPayload(
  existingPayload: Prisma.JsonValue | null,
  verificationData: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  const existingObject = toInputJsonObject(existingPayload);
  const existingSource = existingObject.source;
  const mergedPayload = {
    ...existingObject,
    ...verificationData
  };

  return existingSource === undefined
    ? mergedPayload
    : {
        ...mergedPayload,
        source: existingSource
      };
}

export function getPaymentVerificationRetryAfterSeconds(
  payment: {
    status: PaymentStatus;
    reviewedAt: Date | null;
    updatedAt: Date;
  },
  now = new Date()
): number {
  if (payment.status !== "rejected" && payment.status !== "pending_review") {
    return 0;
  }

  const lastReviewAt = Math.max(payment.reviewedAt?.getTime() ?? 0, payment.updatedAt.getTime());
  const retryAt = lastReviewAt + PAYMENT_RETRY_COOLDOWN_SECONDS * 1000;

  return Math.max(0, Math.ceil((retryAt - now.getTime()) / 1000));
}

export function isPaymentReadyForProviderVerification(status: PaymentStatus): boolean {
  return status === "pending_review" || status === "pending_slip" || status === "rejected";
}

export function assertProviderVerificationResultPersistable(result: SlipVerificationResult): void {
  if (result.status === "provider_error") {
    throw new ProviderVerificationUnavailableError();
  }

  if (result.ok !== (result.status === "verified")) {
    throw new Error("Provider verification status does not match its success result.");
  }

  if (result.ok && !result.transRef) {
    throw new Error("A verified payment result must include a transaction reference.");
  }
}

export function getPersistableProviderResult(result: SlipVerificationResult) {
  return {
    status: result.status,
    transRef: result.transRef,
    amount: result.amount,
    receiverName: result.receiverName
  };
}

export function getOrderRewardPointsForPaymentOutcome(
  status: PaymentStatus | "provider_error",
  amount: Prisma.Decimal
): number {
  return status === "verified" ? calculateOrderRewardPoints(amount) : 0;
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
  if (!isPaymentReadyForProviderVerification(currentStatus)) {
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

export async function claimProviderPaymentVerification(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    expectedOrderId: string;
    expectedOrderUserId: string;
    hostedSlipAttachment: NormalizedHostedAttachment | null;
    paymentId: string;
    qrPayload: string | null;
    source: "qr_payload" | "image_url";
  }
): Promise<ProviderPaymentSnapshot> {
  const hasQrPayload = Boolean(input.qrPayload);
  const hasHostedSlip = Boolean(input.hostedSlipAttachment);

  if (
    hasQrPayload === hasHostedSlip ||
    (input.source === "qr_payload" && !hasQrPayload) ||
    (input.source === "image_url" && !hasHostedSlip)
  ) {
    throw new Error("Exactly one matching payment evidence source is required.");
  }

  const payment = await tx.payment.findUnique({
    where: {
      id: input.paymentId
    },
    select: {
      id: true,
      orderId: true,
      amount: true,
      status: true,
      slipImageUrl: true,
      verificationPayload: true,
      reviewedAt: true,
      updatedAt: true,
      order: {
        select: {
          userId: true
        }
      }
    }
  });

  if (
    !payment ||
    !payment.orderId ||
    !payment.order ||
    payment.orderId !== input.expectedOrderId ||
    payment.order.userId !== input.expectedOrderUserId
  ) {
    throw new PaymentVerificationConflictError();
  }

  if (!isPaymentReadyForProviderVerification(payment.status)) {
    throw new PaymentVerificationConflictError();
  }

  const retryAfterSeconds = getPaymentVerificationRetryAfterSeconds(payment);

  if (retryAfterSeconds > 0) {
    throw new PaymentVerificationRateLimitError(retryAfterSeconds);
  }

  const claimedAt = new Date();
  const slipImageUrl = input.hostedSlipAttachment?.storageUrl ?? payment.slipImageUrl;
  const verificationPayload = mergePaymentVerificationPayload(payment.verificationPayload, {
    providerAttempt: {
      claimedAt: claimedAt.toISOString(),
      claimedBy: input.actorId,
      status: "pending_review"
    },
    submittedEvidence:
      input.source === "qr_payload"
        ? {
            type: "qr_payload",
            submittedAt: claimedAt.toISOString(),
            qrPayload: input.qrPayload as string
          }
        : {
            type: "image_url",
            submittedAt: claimedAt.toISOString(),
            imageUrl: input.hostedSlipAttachment!.storageUrl
          },
    submissionSource: input.source
  });
  const paymentUpdate = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: payment.status,
      updatedAt: payment.updatedAt
    },
    data: {
      status: "pending_review",
      slipImageUrl,
      verificationPayload,
      updatedAt: claimedAt
    }
  });

  if (paymentUpdate.count !== 1) {
    throw new PaymentVerificationConflictError();
  }

  await applyPaymentReadyOrderTransition(tx, {
    orderId: payment.orderId,
    orderStatus: "payment_review"
  });

  await createHostedSlipAttachmentIfNeeded(tx, {
    hostedSlipAttachment: input.hostedSlipAttachment,
    orderId: payment.orderId,
    ownerId: payment.order.userId,
    paymentId: payment.id
  });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "payment.provider_verification_claim",
    entityType: "payment",
    entityId: payment.id,
    metadata: {
      orderId: payment.orderId,
      previousStatus: payment.status,
      nextStatus: "pending_review",
      source: input.source
    }
  });

  return {
    id: payment.id,
    orderId: payment.orderId,
    orderUserId: payment.order.userId,
    amount: payment.amount,
    status: "pending_review",
    slipImageUrl,
    verificationPayload: toJsonValue(verificationPayload) as Prisma.JsonValue,
    updatedAt: claimedAt
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
  const reservationCreatedAfter = new Date(
    reviewedAt.getTime() - STORE_PAYMENT_REVIEW_TTL_MS
  );
  const payment = await tx.payment.findUnique({
    where: {
      id: input.paymentId
    },
    select: {
      id: true,
      orderId: true,
      amount: true,
      status: true,
      verificationPayload: true,
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

  if (transition.paymentStatus === "verified") {
    await assertOrderHasNoOtherCompletedPayment(tx, {
      orderId: payment.orderId,
      paymentId: payment.id
    });
  }

  const paymentUpdate = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: payment.status
    },
    data: {
      status: transition.paymentStatus,
      reviewedById: input.actorId,
      reviewedAt,
      verificationPayload: mergePaymentVerificationPayload(payment.verificationPayload, {
        reviewedAt: reviewedAt.toISOString(),
        reviewedBy: input.actorId,
        verificationSource: "admin_manual_review",
        previousStatus: payment.status,
        nextStatus: transition.paymentStatus
      })
    }
  });

  if (paymentUpdate.count !== 1) {
    throw new PaymentVerificationConflictError();
  }

  await applyPaymentReadyOrderTransition(tx, {
    orderId: payment.orderId,
    orderStatus: transition.orderStatus,
    allowedCurrentStatuses: ["payment_review"],
    reservationCreatedAfter
  });

  if (transition.paymentStatus === "verified") {
    await finalizeReservedOrderInventory(tx, payment.orderId);
  }

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

  await awardVerifiedOrderRewardPoints(tx, {
    amount: payment.amount,
    orderId: payment.orderId,
    paymentStatus: transition.paymentStatus,
    userId: payment.order.userId
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
    payment: ProviderPaymentSnapshot;
    result: SlipVerificationResult;
    source: "qr_payload" | "image_url";
  }
) {
  const reviewedAt = new Date();
  const reservationCreatedAfter = new Date(
    reviewedAt.getTime() - STORE_PAYMENT_REVIEW_TTL_MS
  );

  assertPaymentReadyForProviderVerification(input.payment.status);
  assertProviderVerificationResultPersistable(input.result);

  const transition = getProviderPaymentVerificationTransition(input.result.ok);

  if (input.result.ok && input.result.transRef) {
    await assertVerifiedTransactionReferenceUnused(tx, {
      paymentId: input.payment.id,
      transactionReference: input.result.transRef
    });
    await assertOrderHasNoOtherCompletedPayment(tx, {
      orderId: input.payment.orderId,
      paymentId: input.payment.id
    });
  }

  const paymentUpdate = await tx.payment.updateMany({
    where: {
      id: input.payment.id,
      status: input.payment.status,
      updatedAt: input.payment.updatedAt
    },
    data: {
      status: transition.paymentStatus,
      reviewedAt,
      verificationPayload: mergePaymentVerificationPayload(input.payment.verificationPayload, {
        reviewedAt: reviewedAt.toISOString(),
        verificationSource: input.result.provider,
        result: toJsonValue(getPersistableProviderResult(input.result))
      })
    }
  });

  if (paymentUpdate.count !== 1) {
    throw new PaymentVerificationConflictError();
  }

  await applyPaymentReadyOrderTransition(tx, {
    orderId: input.payment.orderId,
    orderStatus: transition.orderStatus,
    allowedCurrentStatuses: ["payment_review"],
    reservationCreatedAfter
  });

  if (transition.paymentStatus === "verified") {
    await finalizeReservedOrderInventory(tx, input.payment.orderId);
  }

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

  await awardVerifiedOrderRewardPoints(tx, {
    amount: input.payment.amount,
    orderId: input.payment.orderId,
    paymentStatus: transition.paymentStatus,
    userId: input.payment.orderUserId
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

async function assertOrderHasNoOtherCompletedPayment(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    paymentId: string;
  }
) {
  const completedPayment = await tx.payment.findFirst({
    where: {
      id: {
        not: input.paymentId
      },
      orderId: input.orderId,
      status: {
        in: completedPaymentStatuses
      }
    },
    select: {
      id: true
    }
  });

  if (completedPayment) {
    throw new CompletedOrderPaymentConflictError();
  }
}

async function applyPaymentReadyOrderTransition(
  tx: Prisma.TransactionClient,
  input: {
    allowedCurrentStatuses?: OrderStatus[];
    orderId: string;
    orderStatus: OrderStatus;
    reservationCreatedAfter?: Date;
  }
) {
  const orderUpdate = await tx.order.updateMany({
    where: {
      id: input.orderId,
      status: {
        in: input.allowedCurrentStatuses ?? paymentReadyOrderStatuses
      },
      ...(input.reservationCreatedAfter
        ? {
            createdAt: {
              gt: input.reservationCreatedAfter
            }
          }
        : {})
    },
    data: {
      status: input.orderStatus
    }
  });

  if (orderUpdate.count !== 1) {
    throw new PaymentVerificationConflictError();
  }
}

async function finalizeReservedOrderInventory(tx: Prisma.TransactionClient, orderId: string) {
  const orderItems = await tx.orderItem.findMany({
    where: {
      orderId
    },
    select: {
      productId: true,
      quantity: true
    }
  });
  const quantitiesByProduct = orderItems.reduce((quantities, item) => {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);

    return quantities;
  }, new Map<string, number>());

  for (const [productId, quantity] of quantitiesByProduct) {
    const inventoryUpdate = await tx.inventory.updateMany({
      where: {
        productId,
        quantity: {
          gte: quantity
        },
        reservedQuantity: {
          gte: quantity
        }
      },
      data: {
        quantity: {
          decrement: quantity
        },
        reservedQuantity: {
          decrement: quantity
        }
      }
    });

    if (inventoryUpdate.count !== 1) {
      throw new InventoryFinalizationConflictError();
    }
  }
}

async function assertVerifiedTransactionReferenceUnused(
  tx: Prisma.TransactionClient,
  input: {
    paymentId: string;
    transactionReference: string;
  }
) {
  const duplicatePayment = await tx.payment.findFirst({
    where: {
      id: {
        not: input.paymentId
      },
      status: {
        in: completedPaymentStatuses
      },
      verificationPayload: {
        path: "$.result.transRef",
        equals: input.transactionReference
      }
    },
    select: {
      id: true
    }
  });

  if (duplicatePayment) {
    throw new DuplicatePaymentTransactionError();
  }
}

async function awardVerifiedOrderRewardPoints(
  tx: Prisma.TransactionClient,
  input: {
    amount: Prisma.Decimal;
    orderId: string;
    paymentStatus: PaymentStatus;
    userId: string;
  }
) {
  const points = getOrderRewardPointsForPaymentOutcome(input.paymentStatus, input.amount);

  if (points <= 0) {
    return;
  }

  const didAwardReward = await awardRewardPoints(tx, {
    userId: input.userId,
    sourceType: "order",
    sourceId: input.orderId,
    points,
    expiresAt: getRewardExpiryDate()
  });

  if (!didAwardReward) {
    return;
  }

  await tx.notification.create({
    data: {
      userId: input.userId,
      type: "reward",
      channel: "in_app",
      title: "ได้รับแต้มสะสม",
      body: `คุณได้รับ ${points} แต้มจากคำสั่งซื้อที่ชำระแล้ว`,
      metadataJson: {
        orderId: input.orderId,
        href: "/profile/rewards"
      }
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
