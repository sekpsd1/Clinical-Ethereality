"use strict";
/* eslint-disable @typescript-eslint/no-require-imports */

const { createHash } = require("node:crypto");
const { lstat, open, realpath, unlink } = require("node:fs/promises");
const path = require("node:path");

const COUNT_KEYS = Object.freeze([
  "liveConsultations",
  "scheduledConsultations",
  "liveConsultationDays",
  "attendanceCredentials",
  "attendanceEvents",
  "messages",
  "recordings",
  "recordingWebhookEvents",
  "telemedicineConsents",
  "payments",
  "prescriptions",
  "slotLocks",
  "privateAttachments",
  "directAuditRows"
]);

class PurgeGuardError extends Error {
  constructor(code) {
    super(code);
    this.name = "PurgeGuardError";
    this.code = code;
  }
}

function fail(code) {
  throw new PurgeGuardError(code);
}

function sortRecords(records) {
  return [...records].sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

function aggregateSnapshot(snapshot) {
  return {
    liveConsultations: snapshot.liveConsultations.length,
    scheduledConsultations: snapshot.scheduledConsultations.length,
    liveConsultationDays: new Set(
      snapshot.liveConsultations.map((row) => new Date(row.scheduledAt).toISOString().slice(0, 10))
    ).size,
    attendanceCredentials: snapshot.attendanceCredentials.length,
    attendanceEvents: snapshot.attendanceEvents.length,
    messages: snapshot.messages.length,
    recordings: snapshot.recordings.length,
    recordingWebhookEvents: snapshot.recordingWebhookEvents.length,
    telemedicineConsents: snapshot.telemedicineConsents.length,
    payments: snapshot.payments.length,
    prescriptions: snapshot.prescriptions.length,
    slotLocks: snapshot.slotLocks.length,
    privateAttachments: snapshot.privateAttachments.length,
    directAuditRows: snapshot.directAuditRows.length
  };
}

function fingerprintSnapshot(snapshot) {
  const sensitiveEnvelope = {
    customerId: snapshot.customer.id,
    liveConsultations: sortRecords(snapshot.liveConsultations),
    scheduledConsultations: sortRecords(snapshot.scheduledConsultations),
    attendanceCredentials: sortRecords(snapshot.attendanceCredentials),
    attendanceEvents: sortRecords(snapshot.attendanceEvents),
    messages: sortRecords(snapshot.messages),
    recordings: sortRecords(snapshot.recordings),
    recordingWebhookEvents: sortRecords(snapshot.recordingWebhookEvents),
    telemedicineConsents: sortRecords(snapshot.telemedicineConsents),
    payments: sortRecords(snapshot.payments),
    prescriptions: sortRecords(snapshot.prescriptions),
    slotLocks: sortRecords(snapshot.slotLocks),
    privateAttachments: sortRecords(snapshot.privateAttachments),
    directAuditRows: sortRecords(snapshot.directAuditRows)
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(sensitiveEnvelope))).digest("hex");
}

function assertSnapshot(snapshot) {
  if (!snapshot.customer || snapshot.customer.role !== "customer") fail("TARGET_NOT_EXACT_CUSTOMER");
  if (snapshot.liveConsultations.length !== 3) fail("LIVE_COUNT_MISMATCH");
  if (snapshot.scheduledConsultations.length !== 2) fail("SCHEDULED_COUNT_MISMATCH");
  if (aggregateSnapshot(snapshot).liveConsultationDays !== 2) fail("LIVE_DAY_COUNT_MISMATCH");

  const liveIds = new Set(snapshot.liveConsultations.map((row) => row.id));
  const paymentIds = new Set(snapshot.payments.map((row) => row.id));
  const slotLockIds = new Set(snapshot.liveConsultations.flatMap((row) => (row.slotLockId ? [row.slotLockId] : [])));
  const scopedEntityIds = new Set([
    ...liveIds,
    ...snapshot.attendanceCredentials.map((row) => row.id),
    ...snapshot.attendanceEvents.map((row) => row.id),
    ...snapshot.messages.map((row) => row.id),
    ...snapshot.recordings.map((row) => row.id),
    ...snapshot.recordingWebhookEvents.map((row) => row.id),
    ...snapshot.telemedicineConsents.map((row) => row.id),
    ...snapshot.payments.map((row) => row.id),
    ...snapshot.prescriptions.map((row) => row.id),
    ...snapshot.slotLocks.map((row) => row.id),
    ...snapshot.privateAttachments.map((row) => row.id)
  ]);

  for (const row of [...snapshot.liveConsultations, ...snapshot.scheduledConsultations]) {
    if (row.patientId !== snapshot.customer.id) fail("CROSS_CUSTOMER_CONSULTATION");
  }
  if (snapshot.liveConsultations.some((row) => row.status !== "live")) fail("NON_LIVE_TARGET");
  if (snapshot.scheduledConsultations.some((row) => row.status !== "scheduled")) fail("SCHEDULED_SET_INVALID");

  for (const collection of [
    snapshot.attendanceCredentials,
    snapshot.attendanceEvents,
    snapshot.messages,
    snapshot.recordings,
    snapshot.recordingWebhookEvents,
    snapshot.telemedicineConsents,
    snapshot.payments,
    snapshot.prescriptions
  ]) {
    if (collection.some((row) => !liveIds.has(row.consultationId))) fail("DEPENDENCY_SCOPE_VIOLATION");
  }
  if (snapshot.slotLocks.some((row) => !slotLockIds.has(row.id))) fail("SLOT_LOCK_SCOPE_VIOLATION");
  if (snapshot.recordings.some((row) => row.provider !== "zoom")) fail("RECORDING_PROVIDER_UNSUPPORTED");
  if (snapshot.directAuditRows.some((row) => !row.entityId || !scopedEntityIds.has(row.entityId))) {
    fail("AUDIT_SCOPE_VIOLATION");
  }
  if (
    snapshot.privateAttachments.some(
      (row) =>
        row.ownerId !== snapshot.customer.id ||
        row.entityType !== "payment_slip" ||
        row.purpose !== "payment_slip" ||
        !paymentIds.has(row.entityId)
    )
  ) {
    fail("PRIVATE_ATTACHMENT_SCOPE_VIOLATION");
  }
  if (snapshot.linkedOrderItems > 0) fail("PRESCRIPTION_HAS_COMMERCE_DEPENDENCY");
  return snapshot;
}

function assertExpectedCounts(actual, expected) {
  if (!expected || Object.keys(expected).length !== COUNT_KEYS.length) fail("EXPECTED_COUNTS_REQUIRED");
  for (const key of COUNT_KEYS) {
    if (!Number.isSafeInteger(expected[key]) || expected[key] < 0) fail("EXPECTED_COUNTS_INVALID");
    if (actual[key] !== expected[key]) fail("EXPECTED_COUNTS_DRIFT");
  }
}

function validateExecutionConfirmation({ execute, confirmation, fingerprint, expectedCounts, actualCounts }) {
  if (!execute) return;
  if (!/^[a-f0-9]{64}$/.test(fingerprint) || confirmation !== fingerprint) fail("FINGERPRINT_CONFIRMATION_REQUIRED");
  assertExpectedCounts(actualCounts, expectedCounts);
}

function validateBackupGate(gate, now = new Date(), maxAgeMinutes = 60) {
  if (!gate || gate.verified !== true || typeof gate.reference !== "string" || gate.reference.length < 8) {
    fail("VERIFIED_BACKUP_REQUIRED");
  }
  const createdAt = new Date(gate.createdAt);
  const age = now.getTime() - createdAt.getTime();
  if (!Number.isFinite(createdAt.getTime()) || age < 0 || age > maxAgeMinutes * 60_000) {
    fail("FRESH_BACKUP_REQUIRED");
  }
}

function expectedStorageKey(ownerId, paymentId, attachmentId, extension) {
  const owner = createHash("sha256").update(ownerId).digest("hex").slice(0, 24);
  const payment = createHash("sha256").update(paymentId).digest("hex").slice(0, 24);
  return `payments/${owner}/${payment}/${attachmentId}.${extension}`;
}

function extensionForMime(mimeType) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  fail("PRIVATE_FILE_MIME_UNSUPPORTED");
}

function hasExpectedMagic(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function resolvePrivatePath(root, storageKey) {
  if (!path.isAbsolute(root) || path.isAbsolute(storageKey) || storageKey.includes("\\")) fail("PRIVATE_FILE_PATH_INVALID");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...storageKey.split("/"));
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) fail("PRIVATE_FILE_PATH_ESCAPE");
  return resolved;
}

async function validatePrivateAttachmentFile({ root, attachment, referenceCount }) {
  if (referenceCount !== 1) fail("PRIVATE_FILE_NOT_EXCLUSIVE");
  if (!attachment.storageKey || !attachment.mimeType) fail("PRIVATE_FILE_METADATA_INVALID");
  const extension = extensionForMime(attachment.mimeType);
  if (attachment.storageKey !== expectedStorageKey(attachment.ownerId, attachment.entityId, attachment.id, extension)) {
    fail("PRIVATE_FILE_OWNERSHIP_INVALID");
  }
  const filePath = resolvePrivatePath(root, attachment.storageKey);
  let rootRealPath;
  try {
    rootRealPath = await realpath(root);
  } catch {
    fail("PRIVATE_FILE_ROOT_INVALID");
  }
  try {
    const stats = await lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) fail("PRIVATE_FILE_TYPE_INVALID");
    const fileRealPath = await realpath(filePath);
    if (!fileRealPath.startsWith(`${rootRealPath}${path.sep}`)) fail("PRIVATE_FILE_PATH_ESCAPE");
    if (attachment.byteSize != null && stats.size !== attachment.byteSize) fail("PRIVATE_FILE_SIZE_MISMATCH");
    const handle = await open(filePath, "r");
    try {
      const probe = Buffer.alloc(16);
      const { bytesRead } = await handle.read(probe, 0, probe.length, 0);
      if (!hasExpectedMagic(probe.subarray(0, bytesRead), attachment.mimeType)) fail("PRIVATE_FILE_MAGIC_MISMATCH");
    } finally {
      await handle.close();
    }
    return { filePath, fileRealPath, rootRealPath, alreadyAbsent: false };
  } catch (error) {
    if (error && error.code === "ENOENT") return { filePath, rootRealPath, alreadyAbsent: true };
    throw error;
  }
}

async function deleteValidatedPrivateFile(validated) {
  if (!validated.alreadyAbsent) {
    const stats = await lstat(validated.filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) fail("PRIVATE_FILE_TYPE_INVALID");
    const currentRealPath = await realpath(validated.filePath);
    if (
      currentRealPath !== validated.fileRealPath ||
      !currentRealPath.startsWith(`${validated.rootRealPath}${path.sep}`)
    ) {
      fail("PRIVATE_FILE_CHANGED_AFTER_VALIDATION");
    }
    await unlink(validated.filePath);
  }
  try {
    await lstat(validated.filePath);
    fail("PRIVATE_FILE_DELETE_NOT_VERIFIED");
  } catch (error) {
    if (!error || error.code !== "ENOENT") throw error;
  }
}

function safeReport(mode, snapshot, extra = {}) {
  return {
    event: "stuck_uat_consultation_purge",
    mode,
    eligible: mode === "dry-run",
    fingerprint: fingerprintSnapshot(snapshot),
    counts: aggregateSnapshot(snapshot),
    ...extra
  };
}

async function executePurge(input) {
  assertSnapshot(input.snapshot);
  const counts = aggregateSnapshot(input.snapshot);
  const fingerprint = fingerprintSnapshot(input.snapshot);
  validateExecutionConfirmation({
    execute: input.execute,
    confirmation: input.confirmation,
    fingerprint,
    expectedCounts: input.expectedCounts,
    actualCounts: counts
  });
  if (!input.execute) return safeReport("dry-run", input.snapshot);
  validateBackupGate(input.backupGate, input.now);

  const fresh = assertSnapshot(await input.reinspect());
  if (fingerprintSnapshot(fresh) !== fingerprint) fail("FINGERPRINT_DRIFT");
  assertExpectedCounts(aggregateSnapshot(fresh), input.expectedCounts);

  await input.provider.validate(fresh);
  const validatedFiles = await input.files.validate(fresh);
  await input.provider.remove(fresh);
  await input.files.remove(validatedFiles);
  await input.database.remove(fresh, fingerprint, input.expectedCounts);

  const verification = await input.database.verify(fresh);
  if (
    verification.remainingLiveConsultations !== 0 ||
    verification.remainingScopedDependencies !== 0 ||
    verification.scheduledConsultations !== 2 ||
    verification.customerExists !== true
  ) {
    fail("POST_PURGE_VERIFICATION_FAILED");
  }
  return safeReport("executed", fresh, { verified: true });
}

module.exports = {
  COUNT_KEYS,
  PurgeGuardError,
  aggregateSnapshot,
  assertExpectedCounts,
  assertSnapshot,
  deleteValidatedPrivateFile,
  executePurge,
  expectedStorageKey,
  fingerprintSnapshot,
  resolvePrivatePath,
  safeReport,
  validateBackupGate,
  validateExecutionConfirmation,
  validatePrivateAttachmentFile
};
