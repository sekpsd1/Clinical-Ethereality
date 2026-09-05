import type { ConsultationStatus, PaymentStatus, Prisma } from "@prisma/client";

export const CONSULTATION_TEST_RESET_ACTION = "consultation.test_reset_cancel";
export const CONTROLLED_ZOOM_UAT_CREATED_ACTION = "consultation.zoom_uat_fixture_created";
export const CONSULTATION_TEST_RESET_REASON = "test_data_reset";

const CONTROLLED_ZOOM_UAT_SUMMARY_PREFIX =
  "[UAT] Controlled non-monetary Zoom UAT; key=";
const RESETTABLE_CONSULTATION_STATUSES = new Set<ConsultationStatus>([
  "requested",
  "pending_payment",
  "reschedule_required",
  "scheduled",
  "live"
]);

type JsonObject = Record<string, Prisma.JsonValue>;

export type ConsultationTestResetMarker = {
  version: 1;
  kind: typeof CONSULTATION_TEST_RESET_REASON;
  reason: typeof CONSULTATION_TEST_RESET_REASON;
  consultationId: string;
  paymentId: string;
  cancelledAt: string;
  cancelledById: string;
  previousConsultationStatus: ConsultationStatus;
  paymentStatusAtReset: PaymentStatus;
};

function asJsonObject(value: Prisma.JsonValue | null | undefined): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function isResettableConsultationStatus(status: ConsultationStatus): boolean {
  return RESETTABLE_CONSULTATION_STATUSES.has(status);
}

export function isControlledTestConsultation(
  summary: string | null,
  sourceAuditMetadata: Prisma.JsonValue | null
): boolean {
  if (!summary?.startsWith(CONTROLLED_ZOOM_UAT_SUMMARY_PREFIX)) return false;

  const fixtureKey = summary.slice(CONTROLLED_ZOOM_UAT_SUMMARY_PREFIX.length);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,80}$/.test(fixtureKey)) return false;

  const metadata = asJsonObject(sourceAuditMetadata);
  return Boolean(
    metadata?.controlled === true &&
      metadata.nonMonetary === true &&
      metadata.fixtureKey === fixtureKey &&
      typeof metadata.targetFingerprint === "string" &&
      metadata.targetFingerprint.length > 0
  );
}

export function getConsultationTestResetMarker(
  payload: Prisma.JsonValue | null
): ConsultationTestResetMarker | null {
  const reset = asJsonObject(asJsonObject(payload)?.testDataReset);
  if (
    reset?.version !== 1 ||
    reset.kind !== CONSULTATION_TEST_RESET_REASON ||
    reset.reason !== CONSULTATION_TEST_RESET_REASON ||
    typeof reset.consultationId !== "string" ||
    !reset.consultationId ||
    typeof reset.paymentId !== "string" ||
    !reset.paymentId ||
    !isIsoTimestamp(reset.cancelledAt) ||
    typeof reset.cancelledById !== "string" ||
    !reset.cancelledById ||
    typeof reset.previousConsultationStatus !== "string" ||
    !RESETTABLE_CONSULTATION_STATUSES.has(
      reset.previousConsultationStatus as ConsultationStatus
    ) ||
    typeof reset.paymentStatusAtReset !== "string" ||
    ![
      "pending_slip",
      "pending_review",
      "verified",
      "rejected",
      "refunded"
    ].includes(reset.paymentStatusAtReset)
  ) {
    return null;
  }

  return reset as unknown as ConsultationTestResetMarker;
}

export function isScheduleBlockingPendingConsultationPayment(input: {
  consultationId: string | null;
  consultationStatus: ConsultationStatus | null;
  paymentId: string;
  paymentStatus: PaymentStatus;
  verificationPayload: Prisma.JsonValue | null;
}): boolean {
  if (input.paymentStatus !== "pending_slip" && input.paymentStatus !== "pending_review") {
    return false;
  }
  if (input.consultationStatus !== "cancelled" || !input.consultationId) return true;

  const marker = getConsultationTestResetMarker(input.verificationPayload);
  return !(
    marker &&
    marker.consultationId === input.consultationId &&
    marker.paymentId === input.paymentId
  );
}

export function isMatchingConsultationTestResetAudit(
  metadataJson: Prisma.JsonValue | null,
  input: { consultationId: string; paymentId: string | null }
): boolean {
  const metadata = asJsonObject(metadataJson);
  return Boolean(
    metadata?.consultationId === input.consultationId &&
      metadata.paymentId === input.paymentId &&
      metadata.reason === CONSULTATION_TEST_RESET_REASON &&
      typeof metadata.cancelledById === "string" &&
      metadata.cancelledById.length > 0 &&
      isIsoTimestamp(metadata.cancelledAt)
  );
}
