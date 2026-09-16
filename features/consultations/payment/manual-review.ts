import { Prisma, type ConsultationStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { mergePaymentVerificationPayload } from "@/features/payments/service";
import { normalizePaymentTransactionReference } from "@/features/payments/transaction-reference";
import {
  consultationManualReviewEvidenceEntityType,
  paymentSlipEntityType,
  type PreparedPrivatePaymentSlip
} from "@/features/payments/private-slips";
import {
  getActiveConsultationSlotWhere,
  getBangkokCalendarDateKey,
  getScheduledAtForCalendarDate,
  getScheduledSlotTimes,
  getSlotLockExpiresAt
} from "@/features/consultations/booking/slots";
import { findActiveBlockingOverrideForSlot } from "@/features/consultations/booking/blocked-overrides";
import { getNewScheduleDurationMinutes, LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES } from "@/features/consultations/duration-policy";
import {
  isManualConsultationReviewEligibleFailure,
  type SlipVerificationFailure
} from "@/lib/payments/slip-verification";
import {
  findActiveConsultationIntervalConflict,
  lockDoctorConsultationSchedule
} from "@/features/consultations/booking/interval-lock";

export const CONSULTATION_MANUAL_REVIEW_CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MANUAL_APPOINTMENT_TRANSFER_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const consultationManualReviewReasonCodes = [
  "provider_unavailable",
  "provider_timeout",
  "provider_delay",
  "provider_result_ambiguous"
] as const;

export type ConsultationManualReviewReasonCode =
  (typeof consultationManualReviewReasonCodes)[number];

export const consultationManualReviewEvidenceSourceCodes = [
  "bank_statement",
  "bank_email",
  "other_private_image"
] as const;

export type ConsultationManualReviewEvidenceSourceCode =
  (typeof consultationManualReviewEvidenceSourceCodes)[number];

export const manualAppointmentRejectionReasonCodes = [
  "bank_transfer_not_found",
  "amount_mismatch",
  "evidence_invalid",
  "duplicate_transaction_reference"
] as const;

export type ManualAppointmentRejectionReasonCode =
  (typeof manualAppointmentRejectionReasonCodes)[number];

export type ManualAppointmentIntake = {
  attachmentId: string;
  createdAt: Date;
  reasonCode: ConsultationManualReviewReasonCode;
  transferredAt: Date;
};

export class ConsultationManualReviewError extends Error {
  constructor(
    readonly code:
      | "NOT_ELIGIBLE"
      | "INVALID_AMOUNT"
      | "INVALID_TRANSFER_TIME"
      | "INVALID_CONTACT_WINDOW"
      | "MISSING_EVIDENCE"
      | "ADMIN_NOT_ACTIVE"
      | "DUPLICATE_REFERENCE"
      | "CONFLICT"
  ) {
    super(code);
    this.name = "ConsultationManualReviewError";
  }
}

function asJsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Prisma.JsonObject)
    : {};
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getManualAppointmentIntake(
  payload: Prisma.JsonValue | null
): ManualAppointmentIntake | null {
  const intake = asJsonObject(payload).manualAppointmentIntake;
  if (!intake || typeof intake !== "object" || Array.isArray(intake)) return null;
  const object = intake as Prisma.JsonObject;
  const attachmentId =
    typeof object.attachmentId === "string" ? object.attachmentId : null;
  const createdAt = parseDate(object.createdAt);
  const transferredAt = parseDate(object.transferredAt);
  const reasonCode =
    typeof object.reasonCode === "string" &&
    consultationManualReviewReasonCodes.includes(
      object.reasonCode as ConsultationManualReviewReasonCode
    )
      ? (object.reasonCode as ConsultationManualReviewReasonCode)
      : null;

  if (
    object.source !== "admin_manual_appointment" ||
    object.version !== 1 ||
    !attachmentId ||
    !createdAt ||
    !transferredAt ||
    !reasonCode
  ) {
    return null;
  }

  return { attachmentId, createdAt, reasonCode, transferredAt };
}

export type ConsultationProviderFailure = {
  failedAt: Date;
  failure: SlipVerificationFailure;
  provider: "slipok" | "easyslip" | "unknown";
  reasonCode: ConsultationManualReviewReasonCode;
};

function getManualReviewReasonCode(
  failure: SlipVerificationFailure
): ConsultationManualReviewReasonCode | null {
  switch (failure.classification) {
    case "provider_unavailable":
    case "provider_timeout":
    case "provider_delay":
    case "provider_result_ambiguous":
      return failure.classification;
    default:
      return null;
  }
}

export function getConsultationProviderFailure(
  payload: Prisma.JsonValue | null
): ConsultationProviderFailure | null {
  const attempt = asJsonObject(payload).providerAttempt;
  if (!attempt || typeof attempt !== "object" || Array.isArray(attempt)) return null;
  const object = attempt as Prisma.JsonObject;
  if (object.outcome !== "provider_error") return null;
  const failedAt = parseDate(object.failedAt);
  const provider =
    object.provider === "slipok" || object.provider === "easyslip"
      ? object.provider
      : "unknown";
  const storedFailure = asJsonObject(
    object.failure as Prisma.JsonValue | null
  );
  const classification = storedFailure.classification;
  const code = storedFailure.code;
  const retryGuidance = storedFailure.retryGuidance;
  const failure: SlipVerificationFailure =
    typeof classification === "string" &&
    typeof code === "string" &&
    (retryGuidance === "independent_bank_confirmation" ||
      retryGuidance === "retry_after_provider_delay" ||
      retryGuidance === "correct_evidence")
      ? {
          classification:
            classification as SlipVerificationFailure["classification"],
          code,
          retryAfterSeconds:
            typeof storedFailure.retryAfterSeconds === "number" &&
            Number.isInteger(storedFailure.retryAfterSeconds) &&
            storedFailure.retryAfterSeconds > 0
              ? storedFailure.retryAfterSeconds
              : null,
          retryGuidance
        }
      : {
          classification: "provider_result_ambiguous",
          code: "legacy_provider_error",
          retryAfterSeconds: null,
          retryGuidance: "independent_bank_confirmation"
        };

  const reasonCode = getManualReviewReasonCode(failure);
  if (
    !failedAt ||
    !reasonCode ||
    !isManualConsultationReviewEligibleFailure(failure)
  ) {
    return null;
  }

  return { failedAt, failure, provider, reasonCode };
}

export function getConsultationProviderFailureAt(
  payload: Prisma.JsonValue | null
): Date | null {
  return getConsultationProviderFailure(payload)?.failedAt ?? null;
}

export function getConsultationManualReviewEvidenceAttachmentId(
  payload: Prisma.JsonValue | null
): string | null {
  const manualReview = asJsonObject(payload).manualReview;
  if (
    !manualReview ||
    typeof manualReview !== "object" ||
    Array.isArray(manualReview)
  ) {
    return null;
  }
  const attachmentId = (manualReview as Prisma.JsonObject)
    .supportingEvidenceAttachmentId;
  return typeof attachmentId === "string" && attachmentId
    ? attachmentId
    : null;
}

export function isConsultationManualReviewContactEligible(input: {
  customerReportedAt: Date;
  providerFailureAt: Date;
}): boolean {
  const delta = input.customerReportedAt.getTime() - input.providerFailureAt.getTime();
  return delta >= 0 && delta <= CONSULTATION_MANUAL_REVIEW_CONTACT_WINDOW_MS;
}

export async function recordConsultationProviderFailure(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    attemptId: string;
    consultationId: string;
    failure: SlipVerificationFailure;
    provider: "slipok" | "easyslip" | "unknown";
  }
): Promise<void> {
  if (!isManualConsultationReviewEligibleFailure(input.failure)) {
    return;
  }
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${input.consultationId} FOR UPDATE`
  );
  const consultation = await tx.consultation.findUnique({
    where: { id: input.consultationId },
    select: {
      id: true,
      patientId: true,
      status: true,
      payment: {
        select: {
          id: true,
          status: true,
          updatedAt: true,
          verificationPayload: true
        }
      }
    }
  });

  if (
    !consultation ||
    consultation.patientId !== input.actorId ||
    consultation.status !== "pending_payment" ||
    consultation.payment?.status !== "pending_review"
  ) {
    return;
  }

  const failedAt = new Date();
  const payload = asJsonObject(consultation.payment.verificationPayload);
  const existingAttempt = asJsonObject(
    payload.providerAttempt as Prisma.JsonValue | null
  );
  if (existingAttempt.attemptId !== input.attemptId) return;
  const updated = await tx.payment.updateMany({
    where: {
      id: consultation.payment.id,
      status: "pending_review",
      updatedAt: consultation.payment.updatedAt
    },
    data: {
      verificationPayload: mergePaymentVerificationPayload(
        consultation.payment.verificationPayload,
        {
          providerAttempt: {
            ...existingAttempt,
            failedAt: failedAt.toISOString(),
            failure: input.failure,
            outcome: "provider_error",
            provider: input.provider
          }
        }
      )
    }
  });

  if (updated.count !== 1) return;

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "consultation.payment_provider_unavailable",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      paymentId: consultation.payment.id,
      failureClassification: input.failure.classification,
      failureCode: input.failure.code,
      retryGuidance: input.failure.retryGuidance,
      provider: input.provider,
      paymentStatus: "pending_review",
      consultationStatus: "pending_payment"
    }
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
  );
}

export class ManualAppointmentIntakeError extends Error {
  constructor(
    readonly code:
      | "PATIENT_NOT_VERIFIED"
      | "DOCTOR_NOT_ELIGIBLE"
      | "SLOT_UNAVAILABLE"
      | "TRANSFER_OUTSIDE_WINDOW"
      | "CONFLICT"
  ) {
    super(code);
    this.name = "ManualAppointmentIntakeError";
  }
}

export type ManualAppointmentIntakeOutcome = {
  consultationId: string;
  paymentId: string;
  status: "created" | "already_pending" | "already_processed";
};

function isVerifiedActivePatient(patient: {
  role: string;
  status: string;
  fullName: string | null;
  nationalId: string | null;
  dateOfBirth: Date | null;
  phone: string | null;
  normalizedPhone: string | null;
  phoneVerifiedAt: Date | null;
} | null): boolean {
  return Boolean(
    patient?.role === "customer" &&
      patient.status === "active" &&
      patient.fullName &&
      patient.nationalId &&
      /^\d{13}$/.test(patient.nationalId) &&
      patient.dateOfBirth &&
      patient.phone &&
      patient.normalizedPhone &&
      patient.phoneVerifiedAt
  );
}

function isTransferInsideManualAppointmentWindow(
  transferredAt: Date,
  now: Date
): boolean {
  const delta = now.getTime() - transferredAt.getTime();
  return delta >= 0 && delta <= MANUAL_APPOINTMENT_TRANSFER_LOOKBACK_MS;
}

export async function createManualAppointmentPaymentIntake(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    availabilityId: string;
    doctorId: string;
    evidence: PreparedPrivatePaymentSlip;
    patientId: string;
    reasonCode: ConsultationManualReviewReasonCode;
    scheduledAt: Date;
    transferredAt: Date;
  },
  now = new Date()
): Promise<ManualAppointmentIntakeOutcome> {
  if (!isTransferInsideManualAppointmentWindow(input.transferredAt, now)) {
    throw new ManualAppointmentIntakeError("TRANSFER_OUTSIDE_WINDOW");
  }

  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`User\` WHERE \`id\` = ${input.patientId} FOR UPDATE`
  );
  const patient = await tx.user.findUnique({
    where: { id: input.patientId },
    select: {
      role: true,
      status: true,
      fullName: true,
      nationalId: true,
      dateOfBirth: true,
      phone: true,
      normalizedPhone: true,
      phoneVerifiedAt: true
    }
  });
  if (!isVerifiedActivePatient(patient)) {
    throw new ManualAppointmentIntakeError("PATIENT_NOT_VERIFIED");
  }

  const weeklyAvailability = await tx.doctorAvailability.findUnique({
    where: { id: input.availabilityId },
    include: {
      doctor: {
        select: {
          id: true,
          status: true,
          consultationFee: true,
          user: { select: { status: true } }
        }
      }
    }
  });
  const dateOverride = weeklyAvailability
    ? null
    : await tx.doctorAvailabilityDateOverride.findUnique({
        where: { id: input.availabilityId },
        include: {
          doctor: {
            select: {
              id: true,
              status: true,
              consultationFee: true,
              user: { select: { status: true } }
            }
          }
        }
      });
  const source = weeklyAvailability ?? dateOverride;
  if (
    !source?.isActive ||
    source.doctorId !== input.doctorId ||
    source.doctor.status !== "approved" ||
    source.doctor.user.status !== "active" ||
    !source.doctor.consultationFee ||
    source.doctor.consultationFee <= 0
  ) {
    throw new ManualAppointmentIntakeError("DOCTOR_NOT_ELIGIBLE");
  }
  await lockDoctorConsultationSchedule(tx, input.doctorId);

  const dateValue = getBangkokCalendarDateKey(input.scheduledAt);
  let startTime: string;
  let endTime: string;
  let slotMinutes: number;
  let scheduleSource: "weekly" | "date_override";

  if (dateOverride) {
    if (
      dateOverride.type !== "available" ||
      !dateOverride.startTime ||
      !dateOverride.endTime ||
      !dateOverride.slotMinutes ||
      dateOverride.scheduleDate.toISOString().slice(0, 10) !== dateValue
    ) {
      throw new ManualAppointmentIntakeError("SLOT_UNAVAILABLE");
    }
    startTime = dateOverride.startTime;
    endTime = dateOverride.endTime;
    slotMinutes = getNewScheduleDurationMinutes(dateOverride.slotMinutes);
    scheduleSource = "date_override";
  } else {
    const calendarDate = new Date(`${dateValue}T12:00:00+07:00`);
    const effectiveFrom = weeklyAvailability!.effectiveFrom
      ?.toISOString()
      .slice(0, 10);
    const effectiveTo = weeklyAvailability!.effectiveTo
      ?.toISOString()
      .slice(0, 10);
    const closedOverride = await tx.doctorAvailabilityDateOverride.findFirst({
      where: {
        doctorId: input.doctorId,
        scheduleDate: new Date(`${dateValue}T00:00:00.000Z`),
        type: "closed",
        isActive: true
      },
      select: { id: true }
    });
    if (
      weeklyAvailability!.weekday !== calendarDate.getUTCDay() ||
      (effectiveFrom && dateValue < effectiveFrom) ||
      (effectiveTo && dateValue > effectiveTo) ||
      closedOverride
    ) {
      throw new ManualAppointmentIntakeError("SLOT_UNAVAILABLE");
    }
    startTime = weeklyAvailability!.startTime;
    endTime = weeklyAvailability!.endTime;
    slotMinutes = getNewScheduleDurationMinutes(weeklyAvailability!.slotMinutes);
    scheduleSource = "weekly";
  }

  const validSlots = getScheduledSlotTimes(
    getScheduledAtForCalendarDate(dateValue, startTime),
    startTime,
    endTime,
    slotMinutes
  );
  if (
    input.scheduledAt <= now ||
    !validSlots.some((slot) => slot.getTime() === input.scheduledAt.getTime())
  ) {
    throw new ManualAppointmentIntakeError("SLOT_UNAVAILABLE");
  }
  if (await findActiveBlockingOverrideForSlot(tx, { doctorId: input.doctorId, scheduledAt: input.scheduledAt, slotMinutes })) {
    throw new ManualAppointmentIntakeError("SLOT_UNAVAILABLE");
  }

  const existing = await tx.consultation.findFirst({
    where: {
      doctorId: input.doctorId,
      scheduledAt: input.scheduledAt,
      ...getActiveConsultationSlotWhere(now)
    },
    select: {
      id: true,
      patientId: true,
      status: true,
      payment: {
        select: { id: true, status: true, verificationPayload: true }
      }
    }
  });
  const existingIntake = existing?.payment
    ? getManualAppointmentIntake(existing.payment.verificationPayload)
    : null;
  if (
    existing?.patientId === input.patientId &&
    existing.payment &&
    existingIntake &&
    existingIntake.reasonCode === input.reasonCode &&
    existingIntake.transferredAt.getTime() === input.transferredAt.getTime()
  ) {
    return {
      consultationId: existing.id,
      paymentId: existing.payment.id,
      status:
        existing.payment.status === "verified"
          ? "already_processed"
          : "already_pending"
    };
  }
  if (existing) {
    throw new ManualAppointmentIntakeError("SLOT_UNAVAILABLE");
  }
  const intervalConflict = await findActiveConsultationIntervalConflict(tx, {
    doctorId: input.doctorId,
    scheduledAt: input.scheduledAt,
    durationMinutes: slotMinutes,
    now
  });
  if (intervalConflict) {
    throw new ManualAppointmentIntakeError("SLOT_UNAVAILABLE");
  }

  let slotLock: { id: string };
  try {
    slotLock = await tx.consultationSlotLock.create({
      data: {
        doctorId: input.doctorId,
        scheduledAt: input.scheduledAt,
        availabilityId: source.id,
        patientId: input.patientId,
        expiresAt: getSlotLockExpiresAt(now)
      },
      select: { id: true }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ManualAppointmentIntakeError("SLOT_UNAVAILABLE");
    }
    throw error;
  }

  const consultation = await tx.consultation.create({
    data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      slotLockId: slotLock.id,
      bookedDurationMinutes: slotMinutes,
      status: "pending_payment",
      scheduledAt: input.scheduledAt,
      summary: "Admin-assisted appointment pending payment review"
    },
    select: { id: true }
  });
  const payment = await tx.payment.create({
    data: {
      consultationId: consultation.id,
      amount: source.doctor.consultationFee,
      status: "pending_review",
      slipImageUrl: input.evidence.storageUrl,
      verificationPayload: {
        manualAppointmentIntake: {
          version: 1,
          source: "admin_manual_appointment",
          attachmentId: input.evidence.attachmentId,
          createdAt: now.toISOString(),
          createdById: input.actorId,
          reasonCode: input.reasonCode,
          transferredAt: input.transferredAt.toISOString()
        }
      }
    },
    select: { id: true }
  });

  await tx.fileAttachment.create({
    data: {
      id: input.evidence.attachmentId,
      ownerId: input.patientId,
      purpose: "payment_slip",
      status: "attached",
      entityType: paymentSlipEntityType,
      entityId: payment.id,
      storageUrl: input.evidence.storageUrl,
      storageKey: input.evidence.storageKey,
      fileName: input.evidence.fileName,
      mimeType: input.evidence.mimeType,
      byteSize: input.evidence.byteSize,
      metadataJson: {
        storageProvider: "plesk_private_local",
        visibility: "private",
        paymentKind: "consultation",
        submissionSource: "admin_manual_appointment"
      }
    }
  });
  await tx.notification.create({
    data: {
      userId: input.patientId,
      type: "consultation",
      channel: "in_app",
      title: "รอแอดมินตรวจรายการโอน",
      body: "ทีมงานได้รับคำขอและหลักฐานแล้ว แต่ยังไม่ยืนยันนัดหมาย กรุณาไม่ชำระหรือส่งหลักฐานซ้ำ",
      metadataJson: {
        consultationId: consultation.id,
        paymentId: payment.id,
        href: `/consult/appointments/${consultation.id}`
      }
    }
  });
  await writeAuditLog(tx, {
    actorId: input.actorId,
    action: "consultation.manual_appointment_intake",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      paymentId: payment.id,
      doctorId: input.doctorId,
      availabilityId: source.id,
      scheduleSource,
      slotLockId: slotLock.id,
      scheduledAt: input.scheduledAt.toISOString(),
      transferredAt: input.transferredAt.toISOString(),
      reasonCode: input.reasonCode,
      evidenceAttachmentId: input.evidence.attachmentId,
      consultationStatus: "pending_payment",
      paymentStatus: "pending_review"
    }
  });

  return {
    consultationId: consultation.id,
    paymentId: payment.id,
    status: "created"
  };
}

export type ManualConsultationReviewOutcome =
  | "scheduled"
  | "reschedule_required"
  | "rejected"
  | "already_processed";

export async function applyManualConsultationPaymentReview(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    amount: string;
    customerReportedAt: Date;
    confirmationNote: string;
    evidenceSource: ConsultationManualReviewEvidenceSourceCode;
    paymentId: string;
    reasonCode: ConsultationManualReviewReasonCode;
    supportingEvidence: PreparedPrivatePaymentSlip;
    transactionReference: string;
    transferredAt: Date;
  },
  now = new Date()
): Promise<ManualConsultationReviewOutcome> {
  return applyConsultationPaymentReviewDecision(
    tx,
    { kind: "provider_fallback", ...input },
    now
  );
}

export async function applyManualAppointmentPaymentDecision(
  tx: Prisma.TransactionClient,
  input:
    | {
        actorId: string;
        confirmationNote: string;
        decision: "verified";
        evidenceSource: ConsultationManualReviewEvidenceSourceCode;
        paymentId: string;
        supportingEvidence: PreparedPrivatePaymentSlip;
        transactionReference: string;
      }
    | {
        actorId: string;
        confirmationNote?: never;
        decision: "rejected";
        evidenceSource?: never;
        paymentId: string;
        rejectionReasonCode: ManualAppointmentRejectionReasonCode;
        supportingEvidence?: never;
      },
  now = new Date()
): Promise<ManualConsultationReviewOutcome> {
  return applyConsultationPaymentReviewDecision(
    tx,
    { kind: "manual_appointment", ...input },
    now
  );
}

type ConsultationPaymentReviewDecisionInput =
  | ({
      kind: "provider_fallback";
    } & Parameters<typeof applyManualConsultationPaymentReview>[1])
  | ({ kind: "manual_appointment" } & (
      | {
          actorId: string;
          confirmationNote: string;
          decision: "verified";
          evidenceSource: ConsultationManualReviewEvidenceSourceCode;
          paymentId: string;
          supportingEvidence: PreparedPrivatePaymentSlip;
          transactionReference: string;
        }
      | {
          actorId: string;
          confirmationNote?: never;
          decision: "rejected";
          evidenceSource?: never;
          paymentId: string;
          rejectionReasonCode: ManualAppointmentRejectionReasonCode;
          supportingEvidence?: never;
        }
    ));

async function applyConsultationPaymentReviewDecision(
  tx: Prisma.TransactionClient,
  input: ConsultationPaymentReviewDecisionInput,
  now: Date
): Promise<ManualConsultationReviewOutcome> {
  const decision =
    input.kind === "provider_fallback" ? "verified" : input.decision;
  const normalizedReference =
    input.kind === "provider_fallback" || input.decision === "verified"
      ? normalizePaymentTransactionReference(input.transactionReference)
      : null;

  const paymentLookup = await tx.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      consultationId: true,
      consultation: { select: { doctorId: true } }
    }
  });
  if (!paymentLookup?.consultationId || !paymentLookup.consultation) {
    throw new ConsultationManualReviewError("NOT_ELIGIBLE");
  }

  await lockDoctorConsultationSchedule(
    tx,
    paymentLookup.consultation.doctorId
  );
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Consultation\` WHERE \`id\` = ${paymentLookup.consultationId} FOR UPDATE`
  );
  await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Payment\` WHERE \`id\` = ${input.paymentId} FOR UPDATE`
  );
  const consultation = await tx.consultation.findUnique({
    where: { id: paymentLookup.consultationId },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      createdAt: true,
      scheduledAt: true,
      bookedDurationMinutes: true,
      slotLockId: true,
      status: true,
      patient: {
        select: {
          role: true,
          status: true,
          fullName: true,
          nationalId: true,
          dateOfBirth: true,
          phone: true,
          normalizedPhone: true,
          phoneVerifiedAt: true
        }
      },
      doctor: {
        select: {
          userId: true,
          status: true,
          user: { select: { status: true } }
        }
      },
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
          amount: true,
          status: true,
          updatedAt: true,
          normalizedTransactionReference: true,
          reviewedById: true,
          verificationPayload: true
        }
      }
    }
  });

  if (!consultation?.payment || consultation.payment.id !== input.paymentId) {
    throw new ConsultationManualReviewError("NOT_ELIGIBLE");
  }

  const actor = await tx.user.findUnique({
    where: { id: input.actorId },
    select: { role: true, status: true }
  });
  if (!actor || actor.role !== "admin" || actor.status !== "active") {
    throw new ConsultationManualReviewError("ADMIN_NOT_ACTIVE");
  }

  const payment = consultation.payment;
  const priorManualReview = asJsonObject(payment.verificationPayload).manualReview;
  const priorManualReviewObject =
    priorManualReview &&
    typeof priorManualReview === "object" &&
    !Array.isArray(priorManualReview)
      ? (priorManualReview as Prisma.JsonObject)
      : null;
  const expectedVerificationSource =
    input.kind === "provider_fallback"
      ? "line_oa_external_bank"
      : "admin_manual_appointment";
  if (
    decision === "verified" &&
    payment.status === "verified" &&
    payment.normalizedTransactionReference === normalizedReference &&
    priorManualReviewObject?.verificationSource === expectedVerificationSource
  ) {
    return "already_processed";
  }
  if (
    input.kind === "manual_appointment" &&
    input.decision === "rejected" &&
    payment.status === "rejected" &&
    priorManualReviewObject?.verificationSource === expectedVerificationSource &&
    priorManualReviewObject.decision === "rejected" &&
    priorManualReviewObject.rejectionReasonCode === input.rejectionReasonCode
  ) {
    return "already_processed";
  }

  if (
    payment.status !== "pending_review" ||
    (consultation.status !== "pending_payment" &&
      consultation.status !== "reschedule_required")
  ) {
    throw new ConsultationManualReviewError("NOT_ELIGIBLE");
  }

  if (decision === "verified" && !input.supportingEvidence) {
    throw new ConsultationManualReviewError("MISSING_EVIDENCE");
  }

  const providerFailure =
    input.kind === "provider_fallback"
      ? getConsultationProviderFailure(payment.verificationPayload)
      : null;
  const providerFailureAt = providerFailure?.failedAt ?? null;
  const manualAppointmentIntake = getManualAppointmentIntake(
    payment.verificationPayload
  );
  let transferredAt: Date;
  let reasonCode: ConsultationManualReviewReasonCode;
  let customerReportedAt: Date | null = null;

  if (input.kind === "provider_fallback") {
    if (
      !providerFailureAt ||
      !providerFailure ||
      manualAppointmentIntake ||
      input.reasonCode !== providerFailure.reasonCode
    ) {
      throw new ConsultationManualReviewError("NOT_ELIGIBLE");
    }
    if (
      !isConsultationManualReviewContactEligible({
        customerReportedAt: input.customerReportedAt,
        providerFailureAt
      }) ||
      input.customerReportedAt > now
    ) {
      throw new ConsultationManualReviewError("INVALID_CONTACT_WINDOW");
    }
    if (
      input.transferredAt > now ||
      input.transferredAt < consultation.createdAt
    ) {
      throw new ConsultationManualReviewError("INVALID_TRANSFER_TIME");
    }
    if (!new Prisma.Decimal(input.amount).equals(payment.amount)) {
      throw new ConsultationManualReviewError("INVALID_AMOUNT");
    }
    transferredAt = input.transferredAt;
    reasonCode = providerFailure.reasonCode;
    customerReportedAt = input.customerReportedAt;
  } else {
    if (
      !manualAppointmentIntake ||
      !isVerifiedActivePatient(consultation.patient) ||
      consultation.doctor.status !== "approved" ||
      consultation.doctor.user.status !== "active"
    ) {
      throw new ConsultationManualReviewError("NOT_ELIGIBLE");
    }
    transferredAt = manualAppointmentIntake.transferredAt;
    reasonCode = manualAppointmentIntake.reasonCode;
  }

  const attachment = await tx.fileAttachment.findFirst({
    where: {
      ...(manualAppointmentIntake
        ? { id: manualAppointmentIntake.attachmentId }
        : {}),
      entityId: payment.id,
      entityType: paymentSlipEntityType,
      ownerId: consultation.patientId,
      purpose: "payment_slip",
      status: "attached",
      storageKey: { not: null }
    },
    select: { id: true }
  });
  if (!attachment) {
    throw new ConsultationManualReviewError("MISSING_EVIDENCE");
  }

  if (normalizedReference) {
    const duplicate = await tx.payment.findFirst({
      where: {
        id: { not: payment.id },
        normalizedTransactionReference: normalizedReference,
        status: { in: ["verified", "refunded"] }
      },
      select: { id: true }
    });
    if (duplicate) {
      throw new ConsultationManualReviewError("DUPLICATE_REFERENCE");
    }
  }

  const blockedOverride = consultation.scheduledAt && decision === "verified"
    ? await findActiveBlockingOverrideForSlot(tx, {
        doctorId: consultation.doctorId,
        scheduledAt: consultation.scheduledAt,
        slotMinutes: consultation.bookedDurationMinutes ?? LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES
      })
    : null;
  const occupiedSlot =
    consultation.scheduledAt && decision === "verified"
      ? await findActiveConsultationIntervalConflict(tx, {
          doctorId: consultation.doctorId,
          scheduledAt: consultation.scheduledAt,
          durationMinutes: consultation.bookedDurationMinutes,
          excludeConsultationId: consultation.id,
          excludeSlotLockId: consultation.slotLockId ?? undefined,
          now
        })
      : null;
  const hasActiveSlot = Boolean(
    consultation.status === "pending_payment" &&
      consultation.scheduledAt &&
      consultation.slotLock &&
      consultation.slotLock.id === consultation.slotLockId &&
      consultation.slotLock.doctorId === consultation.doctorId &&
      consultation.slotLock.patientId === consultation.patientId &&
      consultation.slotLock.scheduledAt.getTime() ===
        consultation.scheduledAt.getTime() &&
      (!consultation.slotLock.expiresAt || consultation.slotLock.expiresAt > now) &&
      !blockedOverride &&
      !occupiedSlot
  );
  const nextConsultationStatus: ConsultationStatus =
    decision === "rejected"
      ? "cancelled"
      : hasActiveSlot
        ? "scheduled"
        : "reschedule_required";

  const manualReviewPayload =
    input.kind === "provider_fallback"
      ? {
          attachmentId: attachment.id,
          customerReportedAt: customerReportedAt!.toISOString(),
          providerFailureAt: providerFailureAt!.toISOString(),
          reasonCode,
          reviewedAt: now.toISOString(),
          confirmationNote: input.confirmationNote!,
          transferredAt: transferredAt.toISOString(),
          verificationSource: expectedVerificationSource,
          supportingEvidenceAttachmentId:
            input.supportingEvidence!.attachmentId,
          supportingEvidenceSource: input.evidenceSource!,
          decision: "verified"
        }
      : {
          attachmentId: attachment.id,
          intakeCreatedAt: manualAppointmentIntake!.createdAt.toISOString(),
          reasonCode,
          reviewedAt: now.toISOString(),
          transferredAt: transferredAt.toISOString(),
          verificationSource: expectedVerificationSource,
          decision,
          ...(input.decision === "verified"
            ? {
                confirmationNote: input.confirmationNote!,
                supportingEvidenceAttachmentId:
                  input.supportingEvidence!.attachmentId,
                supportingEvidenceSource: input.evidenceSource!
              }
            : {}),
          ...(input.decision === "rejected"
            ? { rejectionReasonCode: input.rejectionReasonCode }
            : {})
        };

  if (decision === "verified") {
    await tx.fileAttachment.create({
      data: {
        id: input.supportingEvidence!.attachmentId,
        ownerId: input.actorId,
        purpose: "other",
        status: "attached",
        entityType: consultationManualReviewEvidenceEntityType,
        entityId: payment.id,
        storageUrl: `/api/admin/payments/evidence/${input.supportingEvidence!.attachmentId}`,
        storageKey: input.supportingEvidence!.storageKey,
        fileName: input.supportingEvidence!.fileName,
        mimeType: input.supportingEvidence!.mimeType,
        byteSize: input.supportingEvidence!.byteSize,
        metadataJson: {
          storageProvider: "plesk_private_local",
          visibility: "admin_only",
          paymentKind: "consultation",
          submissionSource: "admin_external_bank_confirmation",
          evidenceSource: input.evidenceSource!
        }
      }
    });
  }

  try {
    const updatedPayment = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: "pending_review",
        updatedAt: payment.updatedAt
      },
      data: {
        status: decision,
        normalizedTransactionReference: normalizedReference,
        reviewedById: input.actorId,
        reviewedAt: now,
        verificationPayload: mergePaymentVerificationPayload(
          payment.verificationPayload,
          {
            manualReview: manualReviewPayload
          }
        )
      }
    });
    if (updatedPayment.count !== 1) {
      throw new ConsultationManualReviewError("CONFLICT");
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConsultationManualReviewError("DUPLICATE_REFERENCE");
    }
    throw error;
  }

  const updatedConsultation = await tx.consultation.updateMany({
    where: {
      id: consultation.id,
      status: consultation.status,
      slotLockId: consultation.slotLockId
    },
    data:
      nextConsultationStatus === "scheduled"
        ? { status: "scheduled" }
        : { status: nextConsultationStatus, slotLockId: null }
  });
  if (updatedConsultation.count !== 1) {
    throw new ConsultationManualReviewError("CONFLICT");
  }

  if (nextConsultationStatus !== "scheduled" && consultation.slotLockId) {
    await tx.consultationSlotLock.deleteMany({
      where: { id: consultation.slotLockId }
    });
  }

  await tx.notification.create({
    data: {
      userId: consultation.patientId,
      type: "consultation",
      channel: "in_app",
      title: decision === "rejected"
        ? "ไม่สามารถยืนยันรายการโอนได้"
        : hasActiveSlot
          ? "ยืนยันการชำระค่าปรึกษาแล้ว"
          : "ยืนยันการชำระเงินแล้ว กรุณาเลือกเวลาใหม่",
      body: decision === "rejected"
        ? "คำขอนัดหมายถูกยกเลิก กรุณาติดต่อทีมงานหากต้องการตรวจสอบเพิ่มเติม"
        : hasActiveSlot
          ? "แอดมินตรวจรายการโอนและยืนยันนัดหมายของคุณแล้ว"
          : "เวลานัดเดิมถูกปล่อยคืนแล้ว เลือกเวลาใหม่ของแพทย์เดิมโดยไม่ต้องชำระซ้ำ",
      metadataJson: {
        consultationId: consultation.id,
        paymentId: payment.id,
        href: hasActiveSlot || decision === "rejected"
          ? `/consult/appointments/${consultation.id}`
          : `/consult/booking/somchai?doctorId=${consultation.doctorId}&reschedule=${consultation.id}`
      }
    }
  });

  if (nextConsultationStatus === "scheduled") {
    await tx.notification.create({
      data: {
        userId: consultation.doctor.userId,
        type: "consultation",
        channel: "in_app",
        title: "มีนัดหมายปรึกษาใหม่",
        body: "การชำระเงินได้รับการยืนยันแล้ว กรุณาตรวจคิวปรึกษา",
        metadataJson: {
          consultationId: consultation.id,
          href: "/doctor/consultations"
        }
      }
    });
  }

  await writeAuditLog(tx, {
    actorId: input.actorId,
    action:
      input.kind === "provider_fallback"
        ? "consultation.payment_manual_review"
        : "consultation.manual_appointment_payment_review",
    entityType: "consultation",
    entityId: consultation.id,
    metadata: {
      paymentId: payment.id,
      previousPaymentStatus: "pending_review",
      nextPaymentStatus: decision,
      previousConsultationStatus: consultation.status,
      nextConsultationStatus,
      amount: payment.amount.toFixed(2),
      transferredAt: transferredAt.toISOString(),
      ...(customerReportedAt
        ? { customerReportedAt: customerReportedAt.toISOString() }
        : {}),
      ...(providerFailureAt
        ? { providerFailureAt: providerFailureAt.toISOString() }
        : {}),
      reasonCode,
      verificationSource: expectedVerificationSource,
      transactionReferenceRecorded: Boolean(normalizedReference),
      ...(decision === "verified"
        ? {
            supportingEvidenceAttachmentId:
              input.supportingEvidence!.attachmentId,
            supportingEvidenceSource: input.evidenceSource!,
            confirmationNoteRecorded: true
          }
        : {}),
      blockedByScheduleOverride: Boolean(blockedOverride),
      blockedByOccupiedSlot: Boolean(occupiedSlot),
      slotOutcome:
        nextConsultationStatus === "scheduled" ? "retained" : "released",
      ...(input.kind === "manual_appointment" && input.decision === "rejected"
        ? { rejectionReasonCode: input.rejectionReasonCode }
        : {})
    }
  });

  if (decision === "rejected") return "rejected";
  return hasActiveSlot ? "scheduled" : "reschedule_required";
}
