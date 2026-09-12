import { Prisma, type NotificationType, type OrderStatus } from "@prisma/client";
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

export type UserDeletionFile = {
  entityType: string;
  storageKey: string | null;
};

export type UserDeletionResult = {
  removedUserId: string;
  files: UserDeletionFile[];
};

export class UserDeletionError extends Error {
  constructor(readonly code: "NOT_FOUND" | "SELF_DELETE") {
    super(code);
    this.name = "UserDeletionError";
  }
}

export async function cleanupDeletedUserFiles(files: UserDeletionFile[]): Promise<void> {
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

type InventoryAdjustment = {
  productId: string;
  releaseReserved: number;
  restoreQuantity: number;
};

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
    items: Array<{ productId: string; quantity: number }>;
  },
  adjustments: Map<string, InventoryAdjustment>
) {
  if (order.status === "pending_payment" || order.status === "payment_review") {
    for (const item of order.items) {
      appendQuantity(adjustments, item.productId, "releaseReserved", item.quantity);
    }
    return;
  }

  if (["paid", "preparing", "shipped", "delivered"].includes(order.status)) {
    for (const item of order.items) {
      appendQuantity(adjustments, item.productId, "restoreQuantity", item.quantity);
    }
  }
}

function ids(records: ReadonlyArray<{ id: string }>): string[] {
  return records.map((record) => record.id);
}

function metadataContainsReference(
  value: Prisma.JsonValue | null | undefined,
  references: ReadonlySet<string>
): boolean {
  if (typeof value === "string") {
    return references.has(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => metadataContainsReference(item, references));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => metadataContainsReference(item, references));
  }

  return false;
}

function getReferenceNotificationTypes(input: {
  consultationIds: string[];
  orderIds: string[];
  paymentIds: string[];
  prescriptionIds: string[];
  articleIds: string[];
  commentIds: string[];
  reportIds: string[];
}): NotificationType[] {
  const types = new Set<NotificationType>();

  if (input.consultationIds.length > 0) {
    types.add("consultation");
    types.add("payment");
    types.add("prescription");
  }
  if (input.orderIds.length > 0 || input.paymentIds.length > 0) {
    types.add("order");
    types.add("payment");
    types.add("reward");
  }
  if (input.prescriptionIds.length > 0) {
    types.add("prescription");
  }
  if (input.articleIds.length > 0 || input.commentIds.length > 0 || input.reportIds.length > 0) {
    types.add("community");
  }

  return [...types];
}

export async function deleteUserPermanently(
  tx: Prisma.TransactionClient,
  input: { actorId: string; userId: string }
): Promise<UserDeletionResult> {
  if (input.actorId === input.userId) {
    throw new UserDeletionError("SELF_DELETE");
  }

  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${input.userId} FOR UPDATE`
  );

  const target = await tx.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      doctorProfile: { select: { id: true } },
      pharmacistProfile: { select: { id: true } }
    }
  });

  if (!target) {
    throw new UserDeletionError("NOT_FOUND");
  }

  const doctorId = target.doctorProfile?.id;
  const pharmacistId = target.pharmacistProfile?.id;

  const [
    assessments,
    consultations,
    orders,
    articles,
    consentRecords,
    rewardPoints,
    doctorSchedules,
    doctorOverrides,
    shippingAddresses,
    authSessions,
    phoneChallenges
  ] = await Promise.all([
      tx.consultAssessment.findMany({ where: { userId: target.id }, select: { id: true } }),
      tx.consultation.findMany({
        where: {
          OR: [
            { patientId: target.id },
            ...(doctorId ? [{ doctorId }] : [])
          ]
        },
        select: { id: true, slotLockId: true }
      }),
      tx.order.findMany({
        where: { userId: target.id },
        select: {
          id: true,
          status: true,
          items: { select: { id: true, productId: true, quantity: true } }
        }
      }),
      tx.article.findMany({ where: { authorId: target.id }, select: { id: true, slug: true } }),
      tx.consentRecord.findMany({ where: { userId: target.id }, select: { id: true } }),
      tx.rewardPoint.findMany({ where: { userId: target.id }, select: { id: true } }),
      doctorId
        ? tx.doctorAvailability.findMany({ where: { doctorId }, select: { id: true } })
        : Promise.resolve([]),
      doctorId
        ? tx.doctorAvailabilityDateOverride.findMany({ where: { doctorId }, select: { id: true } })
        : Promise.resolve([]),
      tx.shippingAddress.findMany({ where: { userId: target.id }, select: { id: true } }),
      tx.authSession.findMany({ where: { userId: target.id }, select: { id: true } }),
      tx.phoneVerificationChallenge.findMany({ where: { userId: target.id }, select: { id: true } })
    ]);

  const consultationIds = ids(consultations);
  const orderIds = ids(orders);
  const articleIds = ids(articles);

  const [
    prescriptions,
    payments,
    telemedicineConsents,
    consultationMessages,
    comments,
    shipments,
    orderShippingAddresses,
    recordings,
    recordingWebhookEvents,
    attendanceEvents,
    attendanceCredentials,
    slotLocks
  ] =
    await Promise.all([
      tx.prescription.findMany({
        where: {
          OR: [
            { patientId: target.id },
            ...(doctorId ? [{ doctorId }] : []),
            ...(pharmacistId ? [{ pharmacistId }] : []),
            ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
          ]
        },
        select: { id: true }
      }),
      tx.payment.findMany({
        where: {
          OR: [
            ...(orderIds.length > 0 ? [{ orderId: { in: orderIds } }] : []),
            ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
          ]
        },
        select: { id: true }
      }),
      tx.telemedicineConsent.findMany({
        where: {
          OR: [
            { userId: target.id },
            ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
          ]
        },
        select: { id: true }
      }),
      tx.consultationMessage.findMany({
        where: {
          OR: [
            { senderId: target.id },
            ...(consultationIds.length > 0 ? [{ consultationId: { in: consultationIds } }] : [])
          ]
        },
        select: { id: true }
      }),
      tx.comment.findMany({
        where: {
          OR: [
            { userId: target.id },
            ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : [])
          ]
        },
        select: { id: true }
      }),
      tx.shipmentTracking.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } }),
      tx.orderShippingAddress.findMany({ where: { orderId: { in: orderIds } }, select: { orderId: true } }),
      tx.consultationRecording.findMany({
        where: { consultationId: { in: consultationIds } },
        select: { id: true }
      }),
      tx.consultationRecordingWebhookEvent.findMany({
        where: { consultationId: { in: consultationIds } },
        select: { id: true }
      }),
      tx.consultationAttendanceEvent.findMany({
        where: { consultationId: { in: consultationIds } },
        select: { id: true }
      }),
      tx.consultationAttendanceCredential.findMany({
        where: { consultationId: { in: consultationIds } },
        select: { id: true }
      }),
      tx.consultationSlotLock.findMany({
        where: {
          OR: [
            { patientId: target.id },
            ...(doctorId ? [{ doctorId }] : []),
            ...consultations.flatMap((consultation) =>
              consultation.slotLockId ? [{ id: consultation.slotLockId }] : []
            )
          ]
        },
        select: { id: true }
      })
    ]);

  const prescriptionIds = ids(prescriptions);
  const paymentIds = ids(payments);
  const commentIds = ids(comments);

  const [reports, files, likes, savedArticles] = await Promise.all([
    tx.communityReport.findMany({
      where: {
        OR: [
          { reporterId: target.id },
          { reviewerId: target.id },
          ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : []),
          ...(commentIds.length > 0 ? [{ commentId: { in: commentIds } }] : [])
        ]
      },
      select: { id: true }
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
      select: { id: true, entityType: true, storageKey: true }
    }),
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
    })
  ]);

  const inventoryAdjustments = new Map<string, InventoryAdjustment>();
  for (const order of orders) {
    classifyOrderInventory(order, inventoryAdjustments);
  }

  if (inventoryAdjustments.size > 0) {
    const adjustments = [...inventoryAdjustments.values()];
    const inventories = await tx.inventory.findMany({
      where: { productId: { in: adjustments.map((item) => item.productId) } },
      select: { productId: true, quantity: true, reservedQuantity: true }
    });
    const inventoryByProduct = new Map(inventories.map((inventory) => [inventory.productId, inventory]));

    for (const adjustment of adjustments) {
      const inventory = inventoryByProduct.get(adjustment.productId);
      if (!inventory) continue;

      await tx.inventory.update({
        where: { productId: adjustment.productId },
        data: {
          quantity: inventory.quantity + adjustment.restoreQuantity,
          reservedQuantity: Math.max(0, inventory.reservedQuantity - adjustment.releaseReserved)
        }
      });
    }
  }

  const reportIds = ids(reports);
  const fileIds = ids(files);
  const telemedicineConsentIds = ids(telemedicineConsents);
  const consultationMessageIds = ids(consultationMessages);
  const slotLockIds = ids(slotLocks);
  const deletedEntityReferences = [
    target.id,
    ...(doctorId ? [doctorId] : []),
    ...(pharmacistId ? [pharmacistId] : []),
    ...ids(assessments),
    ...consultationIds,
    ...prescriptionIds,
    ...orderIds,
    ...paymentIds,
    ...articleIds,
    ...commentIds,
    ...reportIds,
    ...ids(consentRecords),
    ...telemedicineConsentIds,
    ...consultationMessageIds,
    ...ids(rewardPoints),
    ...ids(shippingAddresses),
    ...ids(authSessions),
    ...ids(phoneChallenges),
    ...fileIds,
    ...slotLockIds,
    ...ids(doctorSchedules),
    ...ids(doctorOverrides),
    ...orders.flatMap((order) => order.items.map((item) => item.id)),
    ...ids(shipments),
    ...orderShippingAddresses.map((address) => address.orderId),
    ...ids(recordings),
    ...ids(recordingWebhookEvents),
    ...ids(attendanceEvents),
    ...ids(attendanceCredentials),
    ...ids(likes),
    ...ids(savedArticles)
  ];

  const notificationTypes = getReferenceNotificationTypes({
    consultationIds,
    orderIds,
    paymentIds,
    prescriptionIds,
    articleIds,
    commentIds,
    reportIds
  });
  const notificationCandidates = await tx.notification.findMany({
    where: {
      OR: [
        { userId: target.id },
        ...(notificationTypes.length > 0 ? [{ type: { in: notificationTypes } }] : [])
      ]
    },
    select: {
      id: true,
      userId: true,
      metadataJson: true
    }
  });
  const notificationReferences = new Set([
    ...deletedEntityReferences,
    ...articles.map((article) => `/community/${article.slug}`)
  ]);
  const notifications = notificationCandidates.filter(
    (notification) =>
      notification.userId === target.id ||
      metadataContainsReference(notification.metadataJson, notificationReferences)
  );
  const relatedEntityIds = [...deletedEntityReferences, ...ids(notifications)];

  await tx.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: target.id },
        { entityId: { in: relatedEntityIds } }
      ]
    }
  });
  await tx.fileAttachment.deleteMany({ where: { id: { in: fileIds } } });
  await tx.communityReport.deleteMany({ where: { id: { in: reportIds } } });
  await tx.like.deleteMany({
    where: {
      OR: [
        { userId: target.id },
        ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : []),
        ...(commentIds.length > 0 ? [{ commentId: { in: commentIds } }] : [])
      ]
    }
  });
  await tx.savedArticle.deleteMany({
    where: {
      OR: [
        { userId: target.id },
        ...(articleIds.length > 0 ? [{ articleId: { in: articleIds } }] : [])
      ]
    }
  });
  await tx.comment.deleteMany({ where: { id: { in: commentIds } } });
  await tx.article.deleteMany({ where: { id: { in: articleIds } } });

  await tx.telemedicineConsent.deleteMany({ where: { id: { in: telemedicineConsentIds } } });
  await tx.consultationRecordingWebhookEvent.deleteMany({
    where: { consultationId: { in: consultationIds } }
  });
  await tx.consultationRecording.deleteMany({ where: { consultationId: { in: consultationIds } } });
  await tx.consultationAttendanceEvent.deleteMany({ where: { consultationId: { in: consultationIds } } });
  await tx.consultationAttendanceCredential.deleteMany({
    where: { consultationId: { in: consultationIds } }
  });
  await tx.consultationMessage.deleteMany({ where: { id: { in: consultationMessageIds } } });
  await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });

  await tx.shipmentTracking.deleteMany({ where: { orderId: { in: orderIds } } });
  await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await tx.orderShippingAddress.deleteMany({ where: { orderId: { in: orderIds } } });
  await tx.order.deleteMany({ where: { id: { in: orderIds } } });
  await tx.prescription.deleteMany({ where: { id: { in: prescriptionIds } } });

  await tx.consultation.updateMany({
    where: { id: { in: consultationIds } },
    data: { slotLockId: null }
  });
  await tx.consultation.deleteMany({ where: { id: { in: consultationIds } } });
  await tx.consultationSlotLock.deleteMany({
    where: { id: { in: slotLockIds } }
  });
  await tx.consultAssessment.deleteMany({ where: { id: { in: ids(assessments) } } });

  await tx.shippingAddress.deleteMany({ where: { id: { in: ids(shippingAddresses) } } });
  await tx.consentRecord.deleteMany({ where: { id: { in: ids(consentRecords) } } });
  await tx.notification.deleteMany({ where: { id: { in: ids(notifications) } } });
  await tx.rewardPoint.deleteMany({ where: { id: { in: ids(rewardPoints) } } });
  await tx.authSession.deleteMany({ where: { id: { in: ids(authSessions) } } });
  await tx.phoneVerificationChallenge.deleteMany({ where: { id: { in: ids(phoneChallenges) } } });
  await tx.user.delete({ where: { id: target.id } });

  return {
    removedUserId: target.id,
    files: files.map(({ entityType, storageKey }) => ({ entityType, storageKey }))
  };
}
