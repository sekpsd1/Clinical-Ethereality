import { createHash } from "node:crypto";
import { Prisma, type OrderStatus, type PaymentStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import {
  communityImageEntityType,
  deleteCommunityImage
} from "@/features/community/images/service";
import {
  deletePrivatePaymentSlip,
  paymentSlipEntityType
} from "@/features/payments/private-slips";
import { deleteStaffFile } from "@/features/staff-files/service";
import { staffFileEntityTypes } from "@/features/staff-files/types";
import {
  formatCustomerReference,
  getCustomerTestResetConfirmation,
  isAllowlistedCustomerTestAccount
} from "@/features/admin/customers/reference";

export type CustomerTestResetCounts = {
  assessments: number;
  consultations: number;
  prescriptions: number;
  orders: number;
  payments: number;
  communityRecords: number;
  profileRecords: number;
  files: number;
  consents: number;
  activeSessions: number;
  reservedUnitsToRelease: number;
  stockUnitsToRestore: number;
};

export type CustomerTestResetPreview = {
  code: "eligible" | "not_found" | "not_test_account" | "staff_profile_present" | "data_conflict";
  eligible: boolean;
  target?: {
    customerId: string;
    reference: string;
    expectedUpdatedAt: string;
    expectedFingerprint: string;
    confirmationText: string;
  };
  counts?: CustomerTestResetCounts;
};

export type CustomerTestResetFile = {
  entityType: string;
  storageKey: string | null;
};

export type CustomerTestResetResult = {
  removedUserId: string;
  counts: CustomerTestResetCounts;
  files: CustomerTestResetFile[];
};

type CustomerTestResetErrorCode =
  | "NOT_FOUND"
  | "NOT_TEST_ACCOUNT"
  | "STAFF_PROFILE_PRESENT"
  | "STALE_PREVIEW"
  | "CONFIRMATION_MISMATCH"
  | "DATA_CONFLICT";

export class CustomerTestResetError extends Error {
  constructor(readonly code: CustomerTestResetErrorCode) {
    super(code);
    this.name = "CustomerTestResetError";
  }
}

export async function cleanupCustomerTestResetFiles(files: CustomerTestResetFile[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      if (file.entityType === paymentSlipEntityType) {
        await deletePrivatePaymentSlip(file.storageKey).catch(() => undefined);
      } else if (file.entityType === communityImageEntityType) {
        await deleteCommunityImage(file.storageKey).catch(() => undefined);
      } else if (
        file.entityType === staffFileEntityTypes.profilePhoto ||
        file.entityType === staffFileEntityTypes.licenseProof
      ) {
        await deleteStaffFile(file.storageKey).catch(() => undefined);
      }
    })
  );
}

type ResetTarget = NonNullable<Awaited<ReturnType<typeof getResetTarget>>>;

type InventoryAdjustment = {
  productId: string;
  releaseReserved: number;
  restoreQuantity: number;
};

type ResetPlan = {
  target: ResetTarget;
  fingerprint: string;
  counts: CustomerTestResetCounts;
  inventoryAdjustments: InventoryAdjustment[];
  ids: {
    assessments: string[];
    consultations: string[];
    prescriptions: string[];
    orders: string[];
    payments: string[];
    articles: string[];
    comments: string[];
    communityReports: string[];
    consentRecords: string[];
    telemedicineConsents: string[];
    consultationMessages: string[];
    slotLocks: string[];
    rewardPoints: string[];
  };
  files: Array<CustomerTestResetFile & { id: string }>;
};

async function getResetTarget(tx: Prisma.TransactionClient, customerId: string) {
  return tx.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      lineUserId: true,
      role: true,
      updatedAt: true,
      doctorProfile: { select: { id: true } },
      pharmacistProfile: { select: { id: true } }
    }
  });
}

function appendQuantity(
  adjustments: Map<string, InventoryAdjustment>,
  productId: string,
  field: "releaseReserved" | "restoreQuantity",
  quantity: number
) {
  const current = adjustments.get(productId) ?? {
    productId,
    releaseReserved: 0,
    restoreQuantity: 0
  };
  current[field] += quantity;
  adjustments.set(productId, current);
}

function classifyOrderInventory(
  order: {
    status: OrderStatus;
    payments: Array<{ status: PaymentStatus }>;
    items: Array<{ productId: string; quantity: number }>;
  },
  adjustments: Map<string, InventoryAdjustment>
) {
  const paymentStatuses = new Set(order.payments.map((payment) => payment.status));
  const hasVerifiedPayment = paymentStatuses.has("verified");
  const hasRefundedPayment = paymentStatuses.has("refunded");
  const reservedStatuses: OrderStatus[] = ["pending_payment", "payment_review"];
  const consumedStatuses: OrderStatus[] = ["paid", "preparing", "shipped", "delivered"];

  if (reservedStatuses.includes(order.status)) {
    if (hasVerifiedPayment || hasRefundedPayment) {
      throw new CustomerTestResetError("DATA_CONFLICT");
    }

    for (const item of order.items) {
      appendQuantity(adjustments, item.productId, "releaseReserved", item.quantity);
    }
    return;
  }

  if (consumedStatuses.includes(order.status)) {
    if (!hasVerifiedPayment || hasRefundedPayment) {
      throw new CustomerTestResetError("DATA_CONFLICT");
    }

    for (const item of order.items) {
      appendQuantity(adjustments, item.productId, "restoreQuantity", item.quantity);
    }
    return;
  }

  if (order.status === "refunded" && !hasRefundedPayment) {
    throw new CustomerTestResetError("DATA_CONFLICT");
  }

  if (order.status === "cancelled" && (hasVerifiedPayment || hasRefundedPayment)) {
    throw new CustomerTestResetError("DATA_CONFLICT");
  }
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function idList(records: ReadonlyArray<{ id: string }>): string[] {
  return records.map((record) => record.id);
}

async function buildResetPlan(tx: Prisma.TransactionClient, target: ResetTarget): Promise<ResetPlan> {
  const [assessments, consultations, orders, articles, consentRecords, rewardPoints] = await Promise.all([
    tx.consultAssessment.findMany({
      where: { userId: target.id },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    }),
    tx.consultation.findMany({
      where: { patientId: target.id },
      orderBy: { id: "asc" },
      select: { id: true, slotLockId: true, updatedAt: true }
    }),
    tx.order.findMany({
      where: { userId: target.id },
      orderBy: { id: "asc" },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        items: {
          orderBy: { id: "asc" },
          select: { id: true, productId: true, quantity: true }
        },
        payments: {
          orderBy: { id: "asc" },
          select: { id: true, status: true, updatedAt: true }
        }
      }
    }),
    tx.article.findMany({
      where: { authorId: target.id },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    }),
    tx.consentRecord.findMany({
      where: { userId: target.id },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    }),
    tx.rewardPoint.findMany({
      where: { userId: target.id },
      orderBy: { id: "asc" },
      select: { id: true }
    })
  ]);

  const consultationIds = idList(consultations);
  const slotLockIds = consultations.flatMap((consultation) =>
    consultation.slotLockId ? [consultation.slotLockId] : []
  );
  const orderIds = idList(orders);
  const articleIds = idList(articles);

  const [prescriptions, payments, telemedicineConsents, consultationMessages, comments] = await Promise.all([
    tx.prescription.findMany({
      where: {
        OR: [
          { patientId: target.id },
          ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
        ]
      },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    }),
    tx.payment.findMany({
      where: {
        OR: [
          ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
          ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
        ]
      },
      orderBy: { id: "asc" },
      select: { id: true, status: true, updatedAt: true }
    }),
    tx.telemedicineConsent.findMany({
      where: {
        OR: [
          { userId: target.id },
          ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
        ]
      },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    }),
    tx.consultationMessage.findMany({
      where: {
        OR: [
          { senderId: target.id },
          ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
        ]
      },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    }),
    tx.comment.findMany({
      where: {
        OR: [
          { userId: target.id },
          ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : [])
        ]
      },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    })
  ]);

  const paymentIds = idList(payments);
  const commentIds = idList(comments);
  const [
    likes,
    savedArticles,
    communityReports,
    files,
    addresses,
    notifications,
    activeSessions,
    phoneChallenges
  ] = await Promise.all([
    tx.like.findMany({
      where: {
        OR: [
          { userId: target.id },
          ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : []),
          ...(commentIds.length > 0 ? [{ commentId: { in: commentIds } }] : [])
        ]
      },
      select: { id: true }
    }),
    tx.savedArticle.findMany({
      where: {
        OR: [
          { userId: target.id },
          ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : [])
        ]
      },
      select: { id: true }
    }),
    tx.communityReport.findMany({
      where: {
        OR: [
          { reporterId: target.id },
          ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : []),
          ...(commentIds.length > 0 ? [{ commentId: { in: commentIds } }] : [])
        ]
      },
      orderBy: { id: "asc" },
      select: { id: true, updatedAt: true }
    }),
    tx.fileAttachment.findMany({
      where: {
        OR: [
          { ownerId: target.id },
          ...(paymentIds.length > 0
            ? [{ entityType: paymentSlipEntityType, entityId: { in: paymentIds } }]
            : []),
          ...(articleIds.length > 0
            ? [{ entityType: communityImageEntityType, entityId: { in: articleIds } }]
            : [])
        ]
      },
      orderBy: { id: "asc" },
      select: { id: true, entityType: true, storageKey: true, updatedAt: true }
    }),
    tx.shippingAddress.count({ where: { userId: target.id } }),
    tx.notification.count({ where: { userId: target.id } }),
    tx.authSession.count({ where: { userId: target.id, status: "active" } }),
    tx.phoneVerificationChallenge.count({ where: { userId: target.id } })
  ]);

  const inventoryByProduct = new Map<string, InventoryAdjustment>();
  for (const order of orders) {
    classifyOrderInventory(order, inventoryByProduct);
  }
  const inventoryAdjustments = [...inventoryByProduct.values()].sort((left, right) =>
    left.productId.localeCompare(right.productId)
  );

  if (inventoryAdjustments.length > 0) {
    const inventories = await tx.inventory.findMany({
      where: { productId: { in: inventoryAdjustments.map((item) => item.productId) } },
      select: { productId: true, reservedQuantity: true }
    });
    const inventoryMap = new Map(inventories.map((inventory) => [inventory.productId, inventory]));

    for (const adjustment of inventoryAdjustments) {
      const inventory = inventoryMap.get(adjustment.productId);
      if (!inventory || inventory.reservedQuantity < adjustment.releaseReserved) {
        throw new CustomerTestResetError("DATA_CONFLICT");
      }
    }
  }

  const communityRecords =
    articles.length + comments.length + likes.length + savedArticles.length + communityReports.length;
  const counts: CustomerTestResetCounts = {
    assessments: assessments.length,
    consultations: consultations.length,
    prescriptions: prescriptions.length,
    orders: orders.length,
    payments: payments.length,
    communityRecords,
    profileRecords: addresses + notifications + rewardPoints.length + phoneChallenges,
    files: files.length,
    consents: consentRecords.length + telemedicineConsents.length,
    activeSessions,
    reservedUnitsToRelease: inventoryAdjustments.reduce((sum, item) => sum + item.releaseReserved, 0),
    stockUnitsToRestore: inventoryAdjustments.reduce((sum, item) => sum + item.restoreQuantity, 0)
  };

  return {
    target,
    counts,
    inventoryAdjustments,
    ids: {
      assessments: idList(assessments),
      consultations: consultationIds,
      prescriptions: idList(prescriptions),
      orders: orderIds,
      payments: paymentIds,
      articles: articleIds,
      comments: commentIds,
      communityReports: idList(communityReports),
      consentRecords: idList(consentRecords),
      telemedicineConsents: idList(telemedicineConsents),
      consultationMessages: idList(consultationMessages),
      slotLocks: slotLockIds,
      rewardPoints: idList(rewardPoints)
    },
    files: files.map(({ id, entityType, storageKey }) => ({ id, entityType, storageKey })),
    fingerprint: fingerprint({
      targetUpdatedAt: target.updatedAt.toISOString(),
      assessments,
      consultations,
      prescriptions,
      orders,
      payments,
      articles,
      comments,
      consentRecords,
      telemedicineConsents,
      consultationMessages,
      communityReports,
      files,
      rewardPoints,
      counts,
      inventoryAdjustments
    })
  };
}

function auditEntityWhere(plan: ResetPlan): Prisma.AuditLogWhereInput[] {
  const groups: Array<{ entityType: string | string[]; ids: string[] }> = [
    { entityType: "consult_assessment", ids: plan.ids.assessments },
    { entityType: ["consultation", "Consultation"], ids: plan.ids.consultations },
    { entityType: "prescription", ids: plan.ids.prescriptions },
    { entityType: "order", ids: plan.ids.orders },
    { entityType: "payment", ids: plan.ids.payments },
    { entityType: "article", ids: plan.ids.articles },
    { entityType: "comment", ids: plan.ids.comments },
    { entityType: "community_report", ids: plan.ids.communityReports },
    { entityType: "consent_record", ids: plan.ids.consentRecords },
    { entityType: "telemedicine_consent", ids: plan.ids.telemedicineConsents },
    { entityType: "consultation_message", ids: plan.ids.consultationMessages },
    { entityType: "reward_point", ids: plan.ids.rewardPoints },
    { entityType: "file_attachment", ids: plan.files.map((file) => file.id) }
  ];

  return groups.flatMap((group) =>
    group.ids.length === 0
      ? []
      : [
          {
            entityType: Array.isArray(group.entityType) ? { in: group.entityType } : group.entityType,
            entityId: { in: group.ids }
          }
        ]
  );
}

export async function previewCustomerTestReset(
  tx: Prisma.TransactionClient,
  customerId: string
): Promise<CustomerTestResetPreview> {
  const target = await getResetTarget(tx, customerId);

  if (!target || target.role !== "customer") return { code: "not_found", eligible: false };
  if (target.doctorProfile || target.pharmacistProfile) {
    return { code: "staff_profile_present", eligible: false };
  }
  if (!isAllowlistedCustomerTestAccount(target.lineUserId)) {
    return { code: "not_test_account", eligible: false };
  }

  try {
    const plan = await buildResetPlan(tx, target);
    const reference = formatCustomerReference(target.lineUserId);

    return {
      code: "eligible",
      eligible: true,
      target: {
        customerId: target.id,
        reference,
        expectedUpdatedAt: target.updatedAt.toISOString(),
        expectedFingerprint: plan.fingerprint,
        confirmationText: getCustomerTestResetConfirmation(reference)
      },
      counts: plan.counts
    };
  } catch (error) {
    if (error instanceof CustomerTestResetError && error.code === "DATA_CONFLICT") {
      return { code: "data_conflict", eligible: false };
    }
    throw error;
  }
}

export async function resetCustomerTestAccount(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    customerId: string;
    expectedUpdatedAt: Date;
    expectedFingerprint: string;
    confirmationText: string;
  }
): Promise<CustomerTestResetResult> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${input.customerId} FOR UPDATE`
  );
  const target = await getResetTarget(tx, input.customerId);

  if (!target || target.role !== "customer") throw new CustomerTestResetError("NOT_FOUND");
  if (target.doctorProfile || target.pharmacistProfile) {
    throw new CustomerTestResetError("STAFF_PROFILE_PRESENT");
  }
  if (!isAllowlistedCustomerTestAccount(target.lineUserId)) {
    throw new CustomerTestResetError("NOT_TEST_ACCOUNT");
  }
  if (target.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
    throw new CustomerTestResetError("STALE_PREVIEW");
  }

  const reference = formatCustomerReference(target.lineUserId);
  if (input.confirmationText.trim() !== getCustomerTestResetConfirmation(reference)) {
    throw new CustomerTestResetError("CONFIRMATION_MISMATCH");
  }

  const plan = await buildResetPlan(tx, target);
  if (plan.fingerprint !== input.expectedFingerprint) {
    throw new CustomerTestResetError("STALE_PREVIEW");
  }

  for (const adjustment of plan.inventoryAdjustments) {
    const inventoryUpdate = await tx.inventory.updateMany({
      where: {
        productId: adjustment.productId,
        reservedQuantity: { gte: adjustment.releaseReserved }
      },
      data: {
        ...(adjustment.releaseReserved > 0
          ? { reservedQuantity: { decrement: adjustment.releaseReserved } }
          : {}),
        ...(adjustment.restoreQuantity > 0
          ? { quantity: { increment: adjustment.restoreQuantity } }
          : {})
      }
    });

    if (inventoryUpdate.count !== 1) throw new CustomerTestResetError("DATA_CONFLICT");
  }

  const auditWhere = auditEntityWhere(plan);
  await tx.auditLog.deleteMany({
    where: {
      OR: [{ actorId: target.id }, { entityType: "user", entityId: target.id }, ...auditWhere]
    }
  });
  await tx.fileAttachment.deleteMany({ where: { id: { in: plan.files.map((file) => file.id) } } });
  await tx.communityReport.deleteMany({ where: { id: { in: plan.ids.communityReports } } });
  await tx.like.deleteMany({
    where: {
      OR: [
        { userId: target.id },
        ...(plan.ids.articles.length > 0 ? [{ articleId: { in: plan.ids.articles } }] : []),
        ...(plan.ids.comments.length > 0 ? [{ commentId: { in: plan.ids.comments } }] : [])
      ]
    }
  });
  await tx.savedArticle.deleteMany({
    where: {
      OR: [
        { userId: target.id },
        ...(plan.ids.articles.length > 0 ? [{ articleId: { in: plan.ids.articles } }] : [])
      ]
    }
  });
  await tx.comment.deleteMany({ where: { id: { in: plan.ids.comments } } });
  await tx.article.deleteMany({ where: { id: { in: plan.ids.articles } } });

  await tx.telemedicineConsent.deleteMany({ where: { id: { in: plan.ids.telemedicineConsents } } });
  await tx.consultationRecordingWebhookEvent.deleteMany({
    where: { consultationId: { in: plan.ids.consultations } }
  });
  await tx.consultationRecording.deleteMany({ where: { consultationId: { in: plan.ids.consultations } } });
  await tx.consultationAttendanceEvent.deleteMany({ where: { consultationId: { in: plan.ids.consultations } } });
  await tx.consultationAttendanceCredential.deleteMany({
    where: { consultationId: { in: plan.ids.consultations } }
  });
  await tx.consultationMessage.deleteMany({ where: { id: { in: plan.ids.consultationMessages } } });
  await tx.payment.deleteMany({ where: { id: { in: plan.ids.payments } } });
  await tx.shipmentTracking.deleteMany({ where: { orderId: { in: plan.ids.orders } } });
  await tx.orderItem.deleteMany({ where: { orderId: { in: plan.ids.orders } } });
  await tx.orderShippingAddress.deleteMany({ where: { orderId: { in: plan.ids.orders } } });
  await tx.order.deleteMany({ where: { id: { in: plan.ids.orders } } });
  await tx.prescription.deleteMany({ where: { id: { in: plan.ids.prescriptions } } });
  await tx.consultation.updateMany({
    where: { id: { in: plan.ids.consultations } },
    data: { slotLockId: null }
  });
  await tx.consultation.deleteMany({ where: { id: { in: plan.ids.consultations } } });
  await tx.consultationSlotLock.deleteMany({
    where: {
      OR: [
        { patientId: target.id },
        ...(plan.ids.slotLocks.length > 0 ? [{ id: { in: plan.ids.slotLocks } }] : [])
      ]
    }
  });
  await tx.consultAssessment.deleteMany({ where: { id: { in: plan.ids.assessments } } });

  await tx.shippingAddress.deleteMany({ where: { userId: target.id } });
  await tx.consentRecord.deleteMany({ where: { id: { in: plan.ids.consentRecords } } });
  await tx.notification.deleteMany({ where: { userId: target.id } });
  await tx.rewardPoint.deleteMany({ where: { id: { in: plan.ids.rewardPoints } } });
  await tx.authSession.deleteMany({ where: { userId: target.id } });
  await tx.phoneVerificationChallenge.deleteMany({ where: { userId: target.id } });
  await tx.user.delete({ where: { id: target.id } });

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "customer.test_account_reset",
    entityType: "user",
    entityId: target.id,
    metadata: {
      resetMode: "delete_allowlisted_uat_identity_and_dependents",
      nextLineLoginCreatesNewCustomer: true,
      counts: plan.counts
    }
  });

  return {
    removedUserId: target.id,
    counts: plan.counts,
    files: plan.files.map(({ entityType, storageKey }) => ({ entityType, storageKey }))
  };
}
