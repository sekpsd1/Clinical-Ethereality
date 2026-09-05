import { Prisma, type ConsultationStatus, type PaymentStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { mergePaymentVerificationPayload } from "@/features/payments/service";
import {
  CONSULTATION_TEST_RESET_ACTION,
  CONSULTATION_TEST_RESET_REASON,
  CONTROLLED_ZOOM_UAT_CREATED_ACTION,
  getConsultationTestResetMarker,
  isControlledTestConsultation,
  isMatchingConsultationTestResetAudit,
  isResettableConsultationStatus,
  type ConsultationTestResetMarker
} from "@/features/admin/consultation-test-reset/policy";

export type ConsultationTestResetPreviewCode =
  | "eligible"
  | "already_reset"
  | "not_found"
  | "not_test_data"
  | "lifecycle_ineligible"
  | "unsafe_slot_lock"
  | "reset_integrity_error";

export type ConsultationTestResetPreview = {
  code: ConsultationTestResetPreviewCode;
  eligible: boolean;
  target: null | {
    consultationId: string;
    doctorId: string;
    status: ConsultationStatus;
    scheduledAt: string | null;
    expectedUpdatedAt: string;
    payment: null | { id: string; status: PaymentStatus };
    slotLock: null | {
      id: string;
      status: "active" | "expired" | "no_expiry";
      owned: boolean;
    };
  };
};

export type ConsultationTestResetOutcome = {
  outcome: "cancelled" | "already_reset";
  consultationId: string;
  paymentPreserved: boolean;
  paymentStatus: PaymentStatus | null;
  slotReleased: boolean;
};

export class ConsultationTestResetError extends Error {
  constructor(
    readonly code:
      | "NOT_ELIGIBLE"
      | "STALE_PREVIEW"
      | "UNSAFE_SLOT_LOCK"
      | "CONFLICT"
      | "INTEGRITY_ERROR"
  ) {
    super(code);
    this.name = "ConsultationTestResetError";
  }
}

type ResetTarget = {
  id: string;
  doctorId: string;
  patientId: string;
  scheduledAt: Date | null;
  slotLockId: string | null;
  status: ConsultationStatus;
  summary: string | null;
  updatedAt: Date;
  slotLock: null | {
    id: string;
    doctorId: string;
    patientId: string | null;
    scheduledAt: Date;
    expiresAt: Date | null;
  };
  payment: null | {
    id: string;
    status: PaymentStatus;
    updatedAt: Date;
    verificationPayload: Prisma.JsonValue | null;
  };
};

const targetSelect = Prisma.validator<Prisma.ConsultationSelect>()({
  id: true,
  doctorId: true,
  patientId: true,
  scheduledAt: true,
  slotLockId: true,
  status: true,
  summary: true,
  updatedAt: true,
  slotLock: {
    select: {
      id: true,
      doctorId: true,
      patientId: true,
      scheduledAt: true,
      expiresAt: true
    }
  },
  payment: {
    select: {
      id: true,
      status: true,
      updatedAt: true,
      verificationPayload: true
    }
  }
});

function isOwnedSlotLock(target: ResetTarget): boolean {
  if (!target.slotLockId) return target.slotLock === null;
  return Boolean(
    target.slotLock &&
      target.slotLock.id === target.slotLockId &&
      target.slotLock.doctorId === target.doctorId &&
      target.slotLock.patientId === target.patientId &&
      target.scheduledAt &&
      target.slotLock.scheduledAt.getTime() === target.scheduledAt.getTime()
  );
}

async function readEligibilityAudits(
  tx: Prisma.TransactionClient,
  consultationId: string
) {
  return tx.auditLog.findMany({
    where: {
      entityType: "consultation",
      entityId: consultationId,
      action: {
        in: [CONTROLLED_ZOOM_UAT_CREATED_ACTION, CONSULTATION_TEST_RESET_ACTION]
      }
    },
    select: { action: true, metadataJson: true },
    orderBy: { createdAt: "asc" }
  });
}

function getPreviewFromTarget(
  target: ResetTarget | null,
  audits: Array<{ action: string; metadataJson: Prisma.JsonValue | null }>,
  now: Date
): ConsultationTestResetPreview {
  if (!target) return { code: "not_found", eligible: false, target: null };

  const sourceAudit = audits.find(
    (audit) => audit.action === CONTROLLED_ZOOM_UAT_CREATED_ACTION
  );
  const resetAudit = audits.find(
    (audit) =>
      audit.action === CONSULTATION_TEST_RESET_ACTION &&
      isMatchingConsultationTestResetAudit(audit.metadataJson, {
        consultationId: target.id,
        paymentId: target.payment?.id ?? null
      })
  );
  const paymentMarker = target.payment
    ? getConsultationTestResetMarker(target.payment.verificationPayload)
    : null;
  const alreadyReset = Boolean(
    target.status === "cancelled" &&
      resetAudit &&
      (!target.payment ||
        (paymentMarker &&
          paymentMarker.consultationId === target.id &&
          paymentMarker.paymentId === target.payment.id))
  );
  const ownedSlotLock = isOwnedSlotLock(target);
  const previewTarget: NonNullable<ConsultationTestResetPreview["target"]> = {
    consultationId: target.id,
    doctorId: target.doctorId,
    status: target.status,
    scheduledAt: target.scheduledAt?.toISOString() ?? null,
    expectedUpdatedAt: target.updatedAt.toISOString(),
    payment: target.payment
      ? { id: target.payment.id, status: target.payment.status }
      : null,
    slotLock: target.slotLock
      ? {
          id: target.slotLock.id,
          status: target.slotLock.expiresAt
            ? target.slotLock.expiresAt > now
              ? "active"
              : "expired"
            : "no_expiry",
          owned: ownedSlotLock
        }
      : null
  };

  if (alreadyReset) {
    return { code: "already_reset", eligible: false, target: previewTarget };
  }
  if (target.status === "cancelled" && (resetAudit || paymentMarker)) {
    return { code: "reset_integrity_error", eligible: false, target: previewTarget };
  }
  if (
    !sourceAudit ||
    !isControlledTestConsultation(target.summary, sourceAudit.metadataJson)
  ) {
    return { code: "not_test_data", eligible: false, target: previewTarget };
  }
  if (!isResettableConsultationStatus(target.status)) {
    return { code: "lifecycle_ineligible", eligible: false, target: previewTarget };
  }
  if (!ownedSlotLock) {
    return { code: "unsafe_slot_lock", eligible: false, target: previewTarget };
  }
  return { code: "eligible", eligible: true, target: previewTarget };
}

export async function previewSelectedTestConsultationReset(
  tx: Prisma.TransactionClient,
  consultationId: string,
  now = new Date()
): Promise<ConsultationTestResetPreview> {
  const target = (await tx.consultation.findUnique({
    where: { id: consultationId },
    select: targetSelect
  })) as ResetTarget | null;
  const audits = target ? await readEligibilityAudits(tx, target.id) : [];
  return getPreviewFromTarget(target, audits, now);
}

export async function cancelSelectedTestConsultation(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    consultationId: string;
    expectedStatus: ConsultationStatus;
    expectedUpdatedAt: Date;
    reason: typeof CONSULTATION_TEST_RESET_REASON;
  },
  now = new Date()
): Promise<ConsultationTestResetOutcome> {
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${input.consultationId} FOR UPDATE`
  );

  const target = (await tx.consultation.findUnique({
    where: { id: input.consultationId },
    select: targetSelect
  })) as ResetTarget | null;
  if (target?.payment) {
    await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT \`id\` FROM \`Payment\` WHERE \`id\` = ${target.payment.id} FOR UPDATE`
    );
  }
  const audits = target ? await readEligibilityAudits(tx, target.id) : [];
  const preview = getPreviewFromTarget(target, audits, now);

  if (preview.code === "already_reset" && target) {
    return {
      outcome: "already_reset",
      consultationId: target.id,
      paymentPreserved: Boolean(target.payment),
      paymentStatus: target.payment?.status ?? null,
      slotReleased: target.slotLockId === null
    };
  }
  if (!target || preview.code === "not_found" || preview.code === "not_test_data" || preview.code === "lifecycle_ineligible") {
    throw new ConsultationTestResetError("NOT_ELIGIBLE");
  }
  if (preview.code === "unsafe_slot_lock") {
    throw new ConsultationTestResetError("UNSAFE_SLOT_LOCK");
  }
  if (preview.code === "reset_integrity_error") {
    throw new ConsultationTestResetError("INTEGRITY_ERROR");
  }
  if (
    target.status !== input.expectedStatus ||
    target.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    throw new ConsultationTestResetError("STALE_PREVIEW");
  }

  let marker: ConsultationTestResetMarker | null = null;
  if (target.payment) {
    marker = {
      version: 1,
      kind: CONSULTATION_TEST_RESET_REASON,
      reason: input.reason,
      consultationId: target.id,
      paymentId: target.payment.id,
      cancelledAt: now.toISOString(),
      cancelledById: input.actorId,
      previousConsultationStatus: target.status,
      paymentStatusAtReset: target.payment.status
    };
    const paymentUpdated = await tx.payment.updateMany({
      where: {
        id: target.payment.id,
        consultationId: target.id,
        status: target.payment.status,
        updatedAt: target.payment.updatedAt
      },
      data: {
        verificationPayload: mergePaymentVerificationPayload(
          target.payment.verificationPayload,
          { testDataReset: marker }
        )
      }
    });
    if (paymentUpdated.count !== 1) {
      throw new ConsultationTestResetError("CONFLICT");
    }
  }

  const consultationUpdated = await tx.consultation.updateMany({
    where: {
      id: target.id,
      status: target.status,
      updatedAt: target.updatedAt,
      slotLockId: target.slotLockId
    },
    data: { status: "cancelled", slotLockId: null }
  });
  if (consultationUpdated.count !== 1) {
    throw new ConsultationTestResetError("CONFLICT");
  }

  if (target.slotLock) {
    const deleted = await tx.consultationSlotLock.deleteMany({
      where: {
        id: target.slotLock.id,
        doctorId: target.doctorId,
        patientId: target.patientId,
        scheduledAt: target.scheduledAt!
      }
    });
    if (deleted.count !== 1) {
      throw new ConsultationTestResetError("CONFLICT");
    }
  }

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: CONSULTATION_TEST_RESET_ACTION,
    entityType: "consultation",
    entityId: target.id,
    metadata: {
      consultationId: target.id,
      doctorId: target.doctorId,
      paymentId: target.payment?.id ?? null,
      paymentStatus: target.payment?.status ?? null,
      reason: input.reason,
      cancelledAt: now.toISOString(),
      cancelledById: input.actorId,
      previousConsultationStatus: target.status,
      nextConsultationStatus: "cancelled",
      slotLockId: target.slotLock?.id ?? null,
      slotOutcome: target.slotLock ? "released" : "none",
      paymentPreserved: Boolean(target.payment),
      paymentMarkerVersion: marker?.version ?? null
    }
  });

  return {
    outcome: "cancelled",
    consultationId: target.id,
    paymentPreserved: Boolean(target.payment),
    paymentStatus: target.payment?.status ?? null,
    slotReleased: Boolean(target.slotLock)
  };
}
