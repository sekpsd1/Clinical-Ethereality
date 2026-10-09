#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { createHash } = require("node:crypto");
const { lstat, readdir, readFile, readlink, realpath } = require("node:fs/promises");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const {
  aggregateSnapshot,
  executePurge,
  fingerprintSnapshot,
  localDateBangkok,
  PurgeGuardError
} = require("./lib/stuck-uat-consultation-purge.cjs");
const {
  buildSnapshot,
  createDatabaseAdapter,
  createFileAdapter,
  parseArguments,
  parseExpectedCounts
} = require("./purge-stuck-uat-consultations.cjs");

const CUSTOMER_LABEL = "Websthai";
const CONFIRMATION = "PURGE_WEBSTHAI_FOUR_LIVE_PRESERVE_EXTERNAL";
const TARGET_DATES = Object.freeze(["2026-09-16", "2026-09-17", "2026-09-18"]);
const SNAPSHOT_POLICY = Object.freeze({
  liveCount: 4,
  scheduledCount: null,
  liveDayCount: null,
  allowedLiveDates: TARGET_DATES
});
const RUNTIME_ENV_KEYS = Object.freeze([
  "DATABASE_URL",
  "NODE_ENV",
  "ZOOM_ACCOUNT_ID",
  "ZOOM_CLIENT_ID",
  "ZOOM_CLIENT_SECRET",
  "GOOGLE_DRIVE_CLIENT_ID",
  "GOOGLE_DRIVE_CLIENT_SECRET",
  "GOOGLE_DRIVE_REFRESH_TOKEN",
  "GOOGLE_DRIVE_ARCHIVE_FOLDER_ID",
  "PAYMENT_UPLOAD_DIR"
]);

function fail(code) {
  throw new PurgeGuardError(code);
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function hash(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function parseProcessEnvironment(buffer) {
  const result = {};
  for (const entry of buffer.toString("utf8").split("\0")) {
    const separator = entry.indexOf("=");
    if (separator <= 0) continue;
    const key = entry.slice(0, separator);
    if (RUNTIME_ENV_KEYS.includes(key)) result[key] = entry.slice(separator + 1);
  }
  return result;
}

async function loadPleskRuntimeEnvironment() {
  if (process.platform !== "linux") fail("PLESK_RUNTIME_ENV_UNAVAILABLE");
  const root = path.resolve(process.cwd());
  const candidates = [];
  for (const entry of await readdir("/proc")) {
    if (!/^\d+$/.test(entry) || Number(entry) === process.pid) continue;
    const base = `/proc/${entry}`;
    try {
      const cwd = path.resolve(await readlink(`${base}/cwd`));
      if (cwd !== root && cwd !== path.join(root, ".next", "standalone")) continue;
      const command = (await readFile(`${base}/cmdline`, "utf8")).split("\0").filter(Boolean);
      if (!command.some((part) => /(^|[\\/])server\.js$/.test(part))) continue;
      const environment = parseProcessEnvironment(await readFile(`${base}/environ`));
      if (environment.NODE_ENV !== "production" || !environment.DATABASE_URL) continue;
      candidates.push(environment);
    } catch {
      // Processes can exit while /proc is being inspected; ignore incomplete candidates.
    }
  }
  if (candidates.length === 0) fail("PLESK_RUNTIME_ENV_UNAVAILABLE");
  const baseline = hash(candidates[0]);
  if (candidates.some((candidate) => hash(candidate) !== baseline)) fail("PLESK_RUNTIME_ENV_AMBIGUOUS");
  for (const key of RUNTIME_ENV_KEYS) {
    if (!process.env[key] && candidates[0][key]) process.env[key] = candidates[0][key];
  }
}

function databaseBoundaryHash(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL_INVALID");
  }
  const database = parsed.pathname.replace(/^\/+/, "");
  if (!parsed.hostname || !database) fail("DATABASE_URL_INVALID");
  return hash({ hostname: parsed.hostname, database });
}

function paymentStatusCounts(snapshot) {
  return Object.fromEntries(
    [...new Set(snapshot.payments.map((row) => row.status))].sort().map((status) => [status, snapshot.payments.filter((row) => row.status === status).length])
  );
}

function archiveStatusCounts(snapshot) {
  return Object.fromEntries(
    [...new Set(snapshot.recordings.map((row) => row.archiveStatus))].sort().map((status) => [status, snapshot.recordings.filter((row) => row.archiveStatus === status).length])
  );
}

async function findExactCustomer(prisma) {
  const matches = await prisma.user.findMany({
    where: {
      role: "customer",
      OR: [{ displayName: CUSTOMER_LABEL }, { fullName: CUSTOMER_LABEL }]
    },
    select: { id: true, lineUserId: true, role: true, status: true, updatedAt: true },
    take: 2
  });
  if (matches.length !== 1 || matches[0].status !== "active") fail("WEBSTHAI_CUSTOMER_NOT_UNIQUE_ACTIVE");
  return matches[0];
}

async function preservationSnapshot(prisma, targetIds, customerId) {
  const [customer, users, doctors, availability, overrides, otherConsultations, assessments] = await Promise.all([
    prisma.user.findUnique({ where: { id: customerId }, select: { id: true, role: true, status: true } }),
    prisma.user.count(),
    prisma.doctor.count(),
    prisma.doctorAvailability.count(),
    prisma.doctorAvailabilityDateOverride.count(),
    prisma.consultation.count({ where: { id: { notIn: targetIds } } }),
    prisma.consultAssessment.count({ where: { userId: customerId } })
  ]);
  return { customer, users, doctors, availability, overrides, otherConsultations, assessments };
}

async function getZoomToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) fail("ZOOM_READ_ADAPTER_NOT_CONFIGURED");
  const url = new URL("https://zoom.us/oauth/token");
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", accountId);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    signal: AbortSignal.timeout(15_000),
    redirect: "error"
  });
  if (!response.ok) fail("ZOOM_READ_AUTH_FAILED");
  const body = await response.json();
  if (!body || typeof body.access_token !== "string" || !body.access_token) fail("ZOOM_READ_AUTH_FAILED");
  return body.access_token;
}

async function listZoomRecordingIds(token, meetingId) {
  const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}/recordings`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
    redirect: "error"
  });
  if (response.status === 404) return [];
  if (!response.ok) fail("ZOOM_RECORDING_READ_FAILED");
  const body = await response.json();
  if (!body || !Array.isArray(body.recording_files)) fail("ZOOM_RECORDING_RESPONSE_INVALID");
  const ids = body.recording_files.map((row) => row?.id);
  if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) {
    fail("ZOOM_RECORDING_RESPONSE_INVALID");
  }
  return ids.sort();
}

async function getDriveToken() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken || !process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID) {
    fail("DRIVE_READ_ADAPTER_NOT_CONFIGURED");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
    signal: AbortSignal.timeout(15_000),
    redirect: "error"
  });
  if (!response.ok) fail("DRIVE_READ_AUTH_FAILED");
  const body = await response.json();
  if (!body || typeof body.access_token !== "string" || !body.access_token) fail("DRIVE_READ_AUTH_FAILED");
  return body.access_token;
}

async function getDriveFile(token, fileId) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,size,mimeType,trashed,parents,appProperties,driveId`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
    redirect: "error"
  });
  if (response.status === 404) return null;
  if (!response.ok) fail("DRIVE_RECORDING_READ_FAILED");
  return response.json();
}

function recordingMime(recording) {
  if (recording.fileType === "mp4" && recording.recordingType === "shared_screen_with_speaker_view") return "video/mp4";
  if (recording.fileType === "txt" && recording.recordingType === "chat_file") return "text/plain";
  fail("RECORDING_VARIANT_UNSUPPORTED");
}

function assertDriveFile(recording, file) {
  const folderId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID;
  const expectedSize = recording.fileSizeBytes == null ? null : String(recording.fileSizeBytes);
  if (!file || file.id !== recording.archiveDriveFileId || file.trashed !== false || file.driveId ||
      !Array.isArray(file.parents) || !file.parents.includes(folderId) ||
      file.appProperties?.clinicalRecording !== recording.id || file.mimeType !== recordingMime(recording) ||
      (expectedSize && file.size !== expectedSize)) fail("DRIVE_RECORDING_MAPPING_INVALID");
}

function createPreservingExternalAdapter(prisma) {
  let state;
  async function inspect(snapshot, { requireDatabaseMapping = true } = {}) {
    if (snapshot.recordings.some((row) => row.archiveStatus === "uploading" || row.archiveStatus === "deleting" || (row.archiveLeaseUntil && row.archiveLeaseUntil > new Date()))) {
      fail("RECORDING_ARCHIVE_ACTIVE");
    }
    const zoomToken = await getZoomToken();
    const zoomByConsultation = new Map();
    for (const consultation of snapshot.liveConsultations) {
      if (!consultation.zoomMeetingId) {
        if (snapshot.recordings.some((row) => row.consultationId === consultation.id)) fail("ZOOM_MEETING_MAPPING_MISSING");
        zoomByConsultation.set(consultation.id, []);
        continue;
      }
      if (requireDatabaseMapping && await prisma.consultation.count({ where: { zoomMeetingId: consultation.zoomMeetingId } }) !== 1) {
        fail("ZOOM_MEETING_MAPPING_NOT_EXCLUSIVE");
      }
      zoomByConsultation.set(consultation.id, await listZoomRecordingIds(zoomToken, consultation.zoomMeetingId));
    }
    const driveRows = snapshot.recordings.filter((row) => row.archiveDriveFileId);
    const driveToken = driveRows.length ? await getDriveToken() : null;
    const driveByRecording = new Map();
    for (const recording of driveRows) {
      const file = await getDriveFile(driveToken, recording.archiveDriveFileId);
      if (recording.archiveStatus === "archived") assertDriveFile(recording, file);
      if (file) assertDriveFile(recording, file);
      driveByRecording.set(recording.id, file ? hash(file) : null);
    }
    for (const recording of snapshot.recordings) {
      const inZoom = zoomByConsultation.get(recording.consultationId)?.includes(recording.providerRecordingId);
      const inDrive = driveByRecording.get(recording.id) != null;
      if (!inZoom && !inDrive) fail("RECORDING_EXTERNAL_COPY_NOT_FOUND");
    }
    return {
      zoomByConsultation,
      driveByRecording,
      summary: {
        meetingsChecked: snapshot.liveConsultations.filter((row) => row.zoomMeetingId).length,
        zoomFilesPresent: [...zoomByConsultation.values()].reduce((sum, ids) => sum + ids.length, 0),
        driveFilesPresent: [...driveByRecording.values()].filter(Boolean).length
      }
    };
  }
  return {
    async validate(snapshot) { state = await inspect(snapshot); return state.summary; },
    async remove() {},
    async verifyPreserved(snapshot) {
      if (!state) fail("EXTERNAL_PRESERVATION_NOT_VALIDATED");
      const after = await inspect(snapshot, { requireDatabaseMapping: false });
      for (const [consultationId, ids] of state.zoomByConsultation) {
        if (JSON.stringify(after.zoomByConsultation.get(consultationId)) !== JSON.stringify(ids)) fail("ZOOM_FILES_CHANGED");
      }
      for (const [recordingId, digest] of state.driveByRecording) {
        if (after.driveByRecording.get(recordingId) !== digest) fail("DRIVE_FILES_CHANGED");
      }
    }
  };
}

function createPreservingFileAdapter(prisma) {
  const base = createFileAdapter(prisma);
  return {
    async validate(snapshot, context) {
      if (snapshot.privateAttachments.length + snapshot.otherScopedAttachments.length === 0) return [];
      return base.validate(snapshot, context);
    },
    async remove() {},
    async verifyPreserved(files) {
      for (const file of files) {
        if (file.alreadyAbsent) fail("PRIVATE_FILE_MISSING");
        const stats = await lstat(file.filePath);
        const current = await realpath(file.filePath);
        if (!stats.isFile() || stats.isSymbolicLink() || current !== file.fileRealPath) fail("PRIVATE_FILE_CHANGED");
      }
    }
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const runtimeEnvRequested = argv.includes("--plesk-runtime-env");
  if (runtimeEnvRequested) await loadPleskRuntimeEnvironment();
  const args = parseArguments(argv.filter((argument) => argument !== "--plesk-runtime-env"));
  if (!process.env.DATABASE_URL) fail("DATABASE_URL_REQUIRED");
  const boundary = databaseBoundaryHash(process.env.DATABASE_URL);
  if (args.execute) {
    if (process.env.NODE_ENV !== "production") fail("ENVIRONMENT_NOT_PRODUCTION");
    if (args["confirm-production"] !== CONFIRMATION) fail("PRODUCTION_CONFIRMATION_REQUIRED");
    if (args["database-boundary"] !== boundary) fail("DATABASE_BOUNDARY_MISMATCH");
  }

  const prisma = new PrismaClient();
  try {
    const customer = await findExactCustomer(prisma);
    const snapshot = await buildSnapshot(prisma, customer.lineUserId, SNAPSHOT_POLICY);
    if (snapshot.liveConsultations.some((row) => !row.scheduledAt || !TARGET_DATES.includes(localDateBangkok(row.scheduledAt)))) {
      fail("LIVE_DATE_SET_MISMATCH");
    }
    const targetIds = snapshot.liveConsultations.map((row) => row.id);
    const preservation = await preservationSnapshot(prisma, targetIds, customer.id);
    const preservationHash = hash(preservation);
    const external = createPreservingExternalAdapter(prisma);
    const localFiles = createPreservingFileAdapter(prisma);
    const externalSummary = await external.validate(snapshot, { recoveryMode: false });
    await localFiles.validate(snapshot, { recoveryMode: false });

    if (!args.execute) {
      process.stdout.write(`${JSON.stringify({
        event: "websthai_four_live_purge",
        mode: "dry-run",
        eligible: true,
        customerMatched: true,
        targetDates: TARGET_DATES,
        fingerprint: fingerprintSnapshot(snapshot),
        preservationHash,
        databaseBoundary: boundary,
        counts: aggregateSnapshot(snapshot),
        paymentStatuses: paymentStatusCounts(snapshot),
        recordingArchiveStatuses: archiveStatusCounts(snapshot),
        external: externalSummary,
        physicalFilesWillBeDeleted: false
      })}\n`);
      return;
    }
    if (args.preservation !== preservationHash) fail("PRESERVATION_FINGERPRINT_REQUIRED");
    const backupGate = {
      verified: args["backup-verified"] === "true",
      reference: args["backup-reference"],
      createdAt: args["backup-created-at"]
    };
    const report = await executePurge({
      snapshot,
      snapshotPolicy: SNAPSHOT_POLICY,
      execute: true,
      confirmation: args.confirm,
      expectedCounts: parseExpectedCounts(args["expected-counts"]),
      backupGate,
      fileBackupGate: backupGate,
      reinspect: () => buildSnapshot(prisma, customer.lineUserId, SNAPSHOT_POLICY),
      provider: external,
      files: localFiles,
      database: createDatabaseAdapter(prisma, customer.lineUserId, { snapshotPolicy: SNAPSHOT_POLICY, preserveExternalFiles: true })
    });
    const afterPreservation = await preservationSnapshot(prisma, targetIds, customer.id);
    if (hash(afterPreservation) !== preservationHash) fail("PRESERVED_RECORDS_CHANGED");
    process.stdout.write(`${JSON.stringify({
      ...report,
      event: "websthai_four_live_purge",
      customerPreserved: true,
      schedulesPreserved: true,
      otherConsultationsPreserved: true,
      zoomFilesPreserved: true,
      driveFilesPreserved: true,
      privateFilesPreserved: true
    })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const code = error instanceof PurgeGuardError ? error.code : "PURGE_FAILED_CLOSED";
    process.stderr.write(`${JSON.stringify({ event: "websthai_four_live_purge", mode: "failed", code })}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRMATION,
  CUSTOMER_LABEL,
  SNAPSHOT_POLICY,
  TARGET_DATES,
  archiveStatusCounts,
  databaseBoundaryHash,
  paymentStatusCounts,
  parseProcessEnvironment,
  preservationSnapshot
};
