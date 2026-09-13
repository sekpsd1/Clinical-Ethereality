#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const { Prisma, PrismaClient } = require("@prisma/client");
const path = require("node:path");
const {
  PurgeGuardError,
  aggregateSnapshot,
  assertExpectedCounts,
  assertSnapshot,
  deleteValidatedPrivateFile,
  executePurge,
  fingerprintSnapshot,
  validatePrivateAttachmentFile
} = require("./lib/stuck-uat-consultation-purge.cjs");

const TARGET_ENV = "ADMIN_PURGE_UAT_LINE_USER_ID";

function fail(code) {
  throw new PurgeGuardError(code);
}

function parseArguments(argv) {
  const result = { execute: false };
  for (const argument of argv) {
    if (argument === "--execute") {
      if (result.execute) fail("INVALID_ARGUMENT");
      result.execute = true;
      continue;
    }
    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator < 3) fail("INVALID_ARGUMENT");
    const name = argument.slice(2, separator);
    const value = argument.slice(separator + 1);
    if (!value || Object.hasOwn(result, name)) fail("INVALID_ARGUMENT");
    result[name] = value;
  }
  return result;
}

function parseExpectedCounts(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") fail("EXPECTED_COUNTS_INVALID");
    return parsed;
  } catch (error) {
    if (error instanceof PurgeGuardError) throw error;
    fail("EXPECTED_COUNTS_INVALID");
  }
}

function assertDatabaseBoundary(databaseUrl, args) {
  if (process.env.NODE_ENV !== "production") fail("ENVIRONMENT_NOT_PRODUCTION");
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL_INVALID");
  }
  const database = url.pathname.replace(/^\/+/, "");
  if (!args["expected-database"] || database !== args["expected-database"]) fail("DATABASE_NAME_MISMATCH");
  if (!args["expected-host"] || url.hostname !== args["expected-host"]) fail("DATABASE_HOST_MISMATCH");
  if (args["confirm-production"] !== "PURGE_STUCK_UAT_LIVE_ONLY") fail("PRODUCTION_CONFIRMATION_REQUIRED");
}

function ids(rows) {
  return rows.map((row) => row.id);
}

function directAuditWhere(groups) {
  const entityIds = Object.values(groups).flat();
  return entityIds.length ? { entityId: { in: entityIds } } : { id: { in: [] } };
}

async function buildSnapshot(db, lineUserId) {
  const customer = await db.user.findUnique({
    where: { lineUserId },
    select: { id: true, role: true, updatedAt: true }
  });
  if (!customer) fail("TARGET_NOT_EXACT_CUSTOMER");

  const [liveConsultations, scheduledConsultations] = await Promise.all([
    db.consultation.findMany({
      where: { patientId: customer.id, status: "live" },
      select: { id: true, patientId: true, status: true, scheduledAt: true, slotLockId: true, zoomMeetingId: true, updatedAt: true },
      orderBy: { id: "asc" }
    }),
    db.consultation.findMany({
      where: { patientId: customer.id, status: "scheduled" },
      select: { id: true, patientId: true, status: true, scheduledAt: true, slotLockId: true, zoomMeetingId: true, updatedAt: true },
      orderBy: { id: "asc" }
    })
  ]);
  const consultationIds = ids(liveConsultations);

  const [
    attendanceCredentials,
    attendanceEvents,
    messages,
    recordings,
    recordingWebhookEvents,
    telemedicineConsents,
    payments,
    prescriptions
  ] = await Promise.all([
    db.consultationAttendanceCredential.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, createdAt: true } }),
    db.consultationAttendanceEvent.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, createdAt: true } }),
    db.consultationMessage.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, updatedAt: true } }),
    db.consultationRecording.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, provider: true, providerRecordingId: true, updatedAt: true } }),
    db.consultationRecordingWebhookEvent.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, createdAt: true } }),
    db.telemedicineConsent.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, updatedAt: true } }),
    db.payment.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, updatedAt: true } }),
    db.prescription.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, updatedAt: true } })
  ]);

  const paymentIds = ids(payments);
  const prescriptionIds = ids(prescriptions);
  const slotLockIds = liveConsultations.flatMap((row) => (row.slotLockId ? [row.slotLockId] : []));
  const [slotLocks, privateAttachments, linkedOrderItems] = await Promise.all([
    db.consultationSlotLock.findMany({ where: { id: { in: slotLockIds } }, select: { id: true, updatedAt: true } }),
    db.fileAttachment.findMany({
      where: { entityType: "payment_slip", purpose: "payment_slip", entityId: { in: paymentIds } },
      select: { id: true, ownerId: true, purpose: true, entityType: true, entityId: true, storageKey: true, mimeType: true, byteSize: true, updatedAt: true }
    }),
    db.orderItem.count({ where: { prescriptionId: { in: prescriptionIds } } })
  ]);
  const auditWhere = directAuditWhere({
    consultationIds,
    paymentIds,
    prescriptionIds,
    attachmentIds: ids(privateAttachments),
    recordingIds: ids(recordings),
    recordingWebhookEventIds: ids(recordingWebhookEvents),
    attendanceCredentialIds: ids(attendanceCredentials),
    attendanceEventIds: ids(attendanceEvents),
    messageIds: ids(messages),
    consentIds: ids(telemedicineConsents),
    slotLockIds: ids(slotLocks)
  });
  const directAuditRows = await db.auditLog.findMany({ where: auditWhere, select: { id: true, entityType: true, entityId: true, createdAt: true } });

  return assertSnapshot({
    customer,
    liveConsultations,
    scheduledConsultations,
    attendanceCredentials,
    attendanceEvents,
    messages,
    recordings,
    recordingWebhookEvents,
    telemedicineConsents,
    payments,
    prescriptions,
    slotLocks,
    privateAttachments,
    directAuditRows,
    linkedOrderItems
  });
}

async function getZoomToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) fail("ZOOM_DELETE_ADAPTER_NOT_CONFIGURED");
  const url = new URL("https://zoom.us/oauth/token");
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", accountId);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) fail("ZOOM_AUTH_OR_SCOPE_FAILED");
  const body = await response.json();
  if (!body || typeof body.access_token !== "string") fail("ZOOM_AUTH_OR_SCOPE_FAILED");
  return body.access_token;
}

async function listZoomRecordings(token, meetingId) {
  const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}/recordings`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status === 404) return { absent: true, ids: [] };
  if (!response.ok) fail("ZOOM_RECORDING_READ_FAILED");
  const body = await response.json();
  if (!body || !Array.isArray(body.recording_files)) fail("ZOOM_RECORDING_RESPONSE_INVALID");
  const providerIds = body.recording_files.map((row) => row && row.id);
  if (providerIds.some((id) => typeof id !== "string" || !id)) fail("ZOOM_RECORDING_RESPONSE_INVALID");
  return { absent: false, ids: providerIds.sort() };
}

function createZoomAdapter(prisma) {
  let token;
  const state = new Map();
  return {
    async validate(snapshot) {
      token = await getZoomToken();
      for (const consultation of snapshot.liveConsultations) {
        const expectedIds = snapshot.recordings
          .filter((row) => row.consultationId === consultation.id)
          .map((row) => row.providerRecordingId)
          .sort();
        if (expectedIds.length && !consultation.zoomMeetingId) fail("ZOOM_MEETING_MAPPING_MISSING");
        if (!consultation.zoomMeetingId) continue;
        if (await prisma.consultation.count({ where: { zoomMeetingId: consultation.zoomMeetingId } }) !== 1) {
          fail("ZOOM_MEETING_MAPPING_NOT_EXCLUSIVE");
        }
        const provider = await listZoomRecordings(token, consultation.zoomMeetingId);
        if (!provider.absent && JSON.stringify(provider.ids) !== JSON.stringify(expectedIds)) fail("ZOOM_RECORDING_MAPPING_DRIFT");
        state.set(consultation.id, { meetingId: consultation.zoomMeetingId, providerIds: expectedIds, absent: provider.absent });
      }
    },
    async remove(snapshot) {
      if (!token) fail("ZOOM_DELETE_ADAPTER_NOT_VALIDATED");
      for (const consultation of snapshot.liveConsultations) {
        const mapping = state.get(consultation.id);
        if (!mapping || mapping.absent) continue;
        for (const providerId of mapping.providerIds) {
          const response = await fetch(
            `https://api.zoom.us/v2/meetings/${encodeURIComponent(mapping.meetingId)}/recordings/${encodeURIComponent(providerId)}?action=delete`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
          );
          if (response.status !== 204 && response.status !== 404) fail("ZOOM_RECORDING_DELETE_FAILED");
        }
        const after = await listZoomRecordings(token, mapping.meetingId);
        if (!after.absent && after.ids.some((id) => mapping.providerIds.includes(id))) fail("ZOOM_RECORDING_DELETE_NOT_VERIFIED");
      }
    }
  };
}

function createFileAdapter(prisma) {
  const root = process.env.PAYMENT_UPLOAD_DIR;
  return {
    async validate(snapshot) {
      if (!root || !path.isAbsolute(root)) fail("PRIVATE_FILE_STORAGE_NOT_CONFIGURED");
      const storageRoot = path.resolve(root);
      const applicationRoot = path.resolve(process.cwd());
      if (
        process.env.NODE_ENV === "production" &&
        (storageRoot === applicationRoot || storageRoot.startsWith(`${applicationRoot}${path.sep}`))
      ) {
        fail("PRIVATE_FILE_STORAGE_NOT_CONFIGURED");
      }
      const validated = [];
      for (const attachment of snapshot.privateAttachments) {
        const referenceCount = await prisma.fileAttachment.count({ where: { storageKey: attachment.storageKey } });
        validated.push(await validatePrivateAttachmentFile({ root: storageRoot, attachment, referenceCount }));
      }
      return validated;
    },
    async remove(validated) {
      for (const file of validated) await deleteValidatedPrivateFile(file);
    }
  };
}

function createDatabaseAdapter(prisma, lineUserId) {
  return {
    async remove(snapshot, fingerprint, expectedCounts) {
      await prisma.$transaction(async (tx) => {
        const fresh = await buildSnapshot(tx, lineUserId);
        if (fingerprintSnapshot(fresh) !== fingerprint) fail("TRANSACTION_FINGERPRINT_DRIFT");
        assertExpectedCounts(aggregateSnapshot(fresh), expectedCounts);
        const consultationIds = ids(fresh.liveConsultations);
        const paymentIds = ids(fresh.payments);
        const prescriptionIds = ids(fresh.prescriptions);
        const attachmentIds = ids(fresh.privateAttachments);
        const auditIds = ids(fresh.directAuditRows);
        const slotLockIds = ids(fresh.slotLocks);
        const deleteExact = async (operation, expected) => {
          const result = await operation;
          if (result.count !== expected) fail("TRANSACTION_DEPENDENCY_COUNT_DRIFT");
        };

        await deleteExact(tx.auditLog.deleteMany({ where: { id: { in: auditIds } } }), fresh.directAuditRows.length);
        await deleteExact(
          tx.fileAttachment.deleteMany({ where: { id: { in: attachmentIds }, ownerId: fresh.customer.id } }),
          fresh.privateAttachments.length
        );
        await deleteExact(
          tx.consultationRecordingWebhookEvent.deleteMany({ where: { consultationId: { in: consultationIds } } }),
          fresh.recordingWebhookEvents.length
        );
        await deleteExact(
          tx.consultationRecording.deleteMany({ where: { consultationId: { in: consultationIds } } }),
          fresh.recordings.length
        );
        await deleteExact(
          tx.consultationAttendanceEvent.deleteMany({ where: { consultationId: { in: consultationIds } } }),
          fresh.attendanceEvents.length
        );
        await deleteExact(
          tx.consultationAttendanceCredential.deleteMany({ where: { consultationId: { in: consultationIds } } }),
          fresh.attendanceCredentials.length
        );
        await deleteExact(
          tx.consultationMessage.deleteMany({ where: { consultationId: { in: consultationIds } } }),
          fresh.messages.length
        );
        await deleteExact(
          tx.telemedicineConsent.deleteMany({ where: { consultationId: { in: consultationIds } } }),
          fresh.telemedicineConsents.length
        );
        await deleteExact(
          tx.payment.deleteMany({ where: { id: { in: paymentIds }, consultationId: { in: consultationIds } } }),
          fresh.payments.length
        );
        await deleteExact(
          tx.prescription.deleteMany({ where: { id: { in: prescriptionIds }, consultationId: { in: consultationIds } } }),
          fresh.prescriptions.length
        );
        await tx.consultation.updateMany({ where: { id: { in: consultationIds }, patientId: fresh.customer.id, status: "live" }, data: { slotLockId: null } });
        const deleted = await tx.consultation.deleteMany({ where: { id: { in: consultationIds }, patientId: fresh.customer.id, status: "live" } });
        if (deleted.count !== 3) fail("TRANSACTION_DELETE_COUNT_DRIFT");
        await deleteExact(tx.consultationSlotLock.deleteMany({ where: { id: { in: slotLockIds } } }), fresh.slotLocks.length);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });
    },
    async verify(snapshot) {
      const consultationIds = ids(snapshot.liveConsultations);
      const [remainingLiveConsultations, scheduledConsultations, customerExists, scoped] = await Promise.all([
        prisma.consultation.count({ where: { id: { in: consultationIds }, patientId: snapshot.customer.id, status: "live" } }),
        prisma.consultation.count({ where: { patientId: snapshot.customer.id, status: "scheduled" } }),
        prisma.user.count({ where: { id: snapshot.customer.id } }),
        Promise.all([
          prisma.consultationAttendanceCredential.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.consultationAttendanceEvent.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.consultationMessage.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.consultationRecording.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.consultationRecordingWebhookEvent.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.telemedicineConsent.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.payment.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.prescription.count({ where: { consultationId: { in: consultationIds } } }),
          prisma.fileAttachment.count({ where: { id: { in: ids(snapshot.privateAttachments) } } }),
          prisma.auditLog.count({ where: { id: { in: ids(snapshot.directAuditRows) } } }),
          prisma.consultationSlotLock.count({ where: { id: { in: ids(snapshot.slotLocks) } } })
        ])
      ]);
      return {
        remainingLiveConsultations,
        scheduledConsultations,
        customerExists: customerExists === 1,
        remainingScopedDependencies: scoped.reduce((sum, count) => sum + count, 0)
      };
    }
  };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const lineUserId = process.env[TARGET_ENV];
  if (!lineUserId) fail("OPAQUE_TARGET_SELECTOR_REQUIRED");
  if (!process.env.DATABASE_URL) fail("DATABASE_URL_REQUIRED");
  if (args.execute) assertDatabaseBoundary(process.env.DATABASE_URL, args);

  const prisma = new PrismaClient();
  try {
    const snapshot = await buildSnapshot(prisma, lineUserId);
    const report = await executePurge({
      snapshot,
      execute: args.execute,
      confirmation: args.confirm,
      expectedCounts: parseExpectedCounts(args["expected-counts"]),
      backupGate: {
        verified: process.env.ADMIN_PURGE_BACKUP_VERIFIED === "true",
        reference: process.env.ADMIN_PURGE_BACKUP_REFERENCE,
        createdAt: process.env.ADMIN_PURGE_BACKUP_CREATED_AT
      },
      reinspect: () => buildSnapshot(prisma, lineUserId),
      provider: createZoomAdapter(prisma),
      files: createFileAdapter(prisma),
      database: createDatabaseAdapter(prisma, lineUserId)
    });
    process.stdout.write(`${JSON.stringify(report)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const code = error instanceof PurgeGuardError ? error.code : "PURGE_FAILED_CLOSED";
    process.stderr.write(`${JSON.stringify({ event: "stuck_uat_consultation_purge", mode: "failed", code })}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildSnapshot, createDatabaseAdapter, createFileAdapter, createZoomAdapter, parseArguments, parseExpectedCounts };
