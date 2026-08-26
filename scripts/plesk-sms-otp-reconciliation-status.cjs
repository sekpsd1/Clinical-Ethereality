/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const RECONCILIATION_STATUS_RELATIVE_PATH = path.join(
  "runtime-private",
  "sms-otp-schema-reconciliation-status.json"
);

const SAFE_RECONCILIATION_EVENTS = Object.freeze({
  diagnostics_probe_ready: { stage: "diagnostics_probe", status: "ready" },
  dispatch_started: { stage: "dispatch", status: "started" },
  dispatch_rejected_duplicate: { stage: "dispatch", status: "rejected_duplicate" },
  target_rejected: { stage: "target", status: "rejected" },
  target_conflict: { stage: "target", status: "conflict" },
  source_rejected: { stage: "source", status: "rejected" },
  source_accepted: { stage: "source", status: "accepted" },
  inspection_started: { stage: "inspection", status: "started" },
  inspection_unavailable: { stage: "inspection", status: "unavailable" },
  precondition_rejected: { stage: "precondition", status: "rejected" },
  precondition_accepted: { stage: "precondition", status: "accepted" },
  schema_creation_started: { stage: "schema_creation", status: "started" },
  schema_creation_failed: { stage: "schema_creation", status: "failed" },
  schema_creation_ready: { stage: "schema_creation", status: "ready" },
  parity_before_resolve_failed: { stage: "parity_before_resolve", status: "failed" },
  parity_before_resolve_ready: { stage: "parity_before_resolve", status: "ready" },
  migration_resolve_started: { stage: "migration_resolve", status: "started" },
  migration_resolve_failed: { stage: "migration_resolve", status: "failed" },
  migration_resolve_ready: { stage: "migration_resolve", status: "ready" },
  final_parity_failed: { stage: "final_parity", status: "failed" },
  complete_ready: {
    stage: "complete",
    status: "ready",
    action: "remove_target_and_restart"
  }
});

const SAFE_RECONCILIATION_REASON_COMPONENTS = Object.freeze([
  "migration_state",
  "user_table",
  "user_columns",
  "user_indexes",
  "challenge_absence",
  "inspection"
]);

const SAFE_RECONCILIATION_USER_TABLE_REASON_DETAILS = Object.freeze([
  "missing",
  "wrong_type",
  "metadata_unavailable",
  "collation_incompatible",
  "unsupported_collation"
]);

const SAFE_RECONCILIATION_USER_COLUMNS_REASON_DETAILS = Object.freeze([
  "metadata_unavailable",
  "id_missing",
  "id_type",
  "id_nullability",
  "id_length",
  "id_default",
  "full_name_missing",
  "full_name_type",
  "full_name_nullability",
  "full_name_length",
  "full_name_default",
  "date_of_birth_missing",
  "date_of_birth_type",
  "date_of_birth_nullability",
  "date_of_birth_default",
  "normalized_phone_missing",
  "normalized_phone_type",
  "normalized_phone_nullability",
  "normalized_phone_length",
  "normalized_phone_default",
  "phone_verified_at_missing",
  "phone_verified_at_type",
  "phone_verified_at_nullability",
  "phone_verified_at_precision",
  "phone_verified_at_default"
]);

function isSafeReasonDetail(reasonComponent, reasonDetail) {
  if (reasonComponent === "user_table") {
    return SAFE_RECONCILIATION_USER_TABLE_REASON_DETAILS.includes(reasonDetail);
  }
  if (reasonComponent === "user_columns") {
    return SAFE_RECONCILIATION_USER_COLUMNS_REASON_DETAILS.includes(reasonDetail);
  }
  return false;
}

function getSafeReconciliationEvent(eventName) {
  if (!Object.prototype.hasOwnProperty.call(SAFE_RECONCILIATION_EVENTS, eventName)) {
    throw new Error("SMS OTP reconciliation status event is not allowlisted.");
  }

  return SAFE_RECONCILIATION_EVENTS[eventName];
}

function writePleskSmsOtpReconciliationStatus({
  rootDir,
  eventName,
  reasonComponent,
  reasonDetail,
  now = () => new Date()
}) {
  if (typeof rootDir !== "string" || !path.isAbsolute(rootDir)) {
    throw new Error("SMS OTP reconciliation status root must be absolute.");
  }

  const event = getSafeReconciliationEvent(eventName);
  if (
    reasonComponent !== undefined &&
    (eventName !== "precondition_rejected" ||
      !SAFE_RECONCILIATION_REASON_COMPONENTS.includes(reasonComponent))
  ) {
    throw new Error("SMS OTP reconciliation status reason component is not allowlisted.");
  }
  if (
    reasonDetail !== undefined &&
    (eventName !== "precondition_rejected" ||
      !isSafeReasonDetail(reasonComponent, reasonDetail))
  ) {
    throw new Error("SMS OTP reconciliation status reason detail is not allowlisted.");
  }
  const updatedAt = now();
  if (!(updatedAt instanceof Date) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("SMS OTP reconciliation status time is invalid.");
  }

  const directory = path.join(rootDir, path.dirname(RECONCILIATION_STATUS_RELATIVE_PATH));
  const destination = path.join(rootDir, RECONCILIATION_STATUS_RELATIVE_PATH);
  const temporary = `${destination}.${process.pid}.tmp`;
  const payload = {
    version: 1,
    component: "sms_otp_schema_reconciliation",
    ...event,
    ...(reasonComponent === undefined ? {} : { reasonComponent }),
    ...(reasonDetail === undefined ? {} : { reasonDetail }),
    updatedAt: updatedAt.toISOString()
  };

  fs.mkdirSync(directory, { mode: 0o700, recursive: true });
  fs.chmodSync(directory, 0o700);

  try {
    fs.writeFileSync(temporary, `${JSON.stringify(payload)}\n`, {
      encoding: "utf8",
      flag: "w",
      mode: 0o600
    });
    fs.renameSync(temporary, destination);
    fs.chmodSync(destination, 0o600);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // Best-effort cleanup only; the caller still fails closed before continuing.
    }
    throw error;
  }

  return destination;
}

module.exports = {
  RECONCILIATION_STATUS_RELATIVE_PATH,
  SAFE_RECONCILIATION_EVENTS,
  SAFE_RECONCILIATION_REASON_COMPONENTS,
  SAFE_RECONCILIATION_USER_COLUMNS_REASON_DETAILS,
  SAFE_RECONCILIATION_USER_TABLE_REASON_DETAILS,
  getSafeReconciliationEvent,
  writePleskSmsOtpReconciliationStatus
};
