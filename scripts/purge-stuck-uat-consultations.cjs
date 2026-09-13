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
  validateProviderRecordingSet,
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

function metadataConsultationId(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  return typeof value.consultationId === "string" ? value.consultationId : null;
}

function jsonObject(value) {
  return value && !Array.isArray(value) && typeof value === "object" ? value : null;
}

function exactIsoDate(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function minimizePaymentVerificationPayload(value) {
  const payload = jsonObject(value);
  const evidence = jsonObject(payload?.submittedEvidence);
  const hasExactPrivateFileBinding =
    payload?.submissionSource === "private_file" &&
    evidence?.type === "private_file" &&
    typeof evidence.attachmentId === "string" &&
    evidence.attachmentId.length > 0;
  const privateFileSubmissionAttachmentId =
    hasExactPrivateFileBinding && exactIsoDate(evidence.submittedAt)
      ? evidence.attachmentId
      : null;
  const legacyPrivateFileSubmissionAttachmentId =
    hasExactPrivateFileBinding && !Object.hasOwn(evidence, "submittedAt")
      ? evidence.attachmentId
      : null;

  const intake = jsonObject(payload?.manualAppointmentIntake);
  const validManualReasonCodes = new Set([
    "provider_unavailable",
    "provider_timeout",
    "provider_result_ambiguous"
  ]);
  const manualAppointmentAttachmentId =
    intake?.version === 1 &&
    intake?.source === "admin_manual_appointment" &&
    typeof intake.attachmentId === "string" &&
    intake.attachmentId.length > 0 &&
    typeof intake.createdById === "string" &&
    intake.createdById.length > 0 &&
    exactIsoDate(intake.createdAt) &&
    exactIsoDate(intake.transferredAt) &&
    validManualReasonCodes.has(intake.reasonCode)
      ? intake.attachmentId
      : null;

  return {
    privateFileSubmissionAttachmentId,
    legacyPrivateFileSubmissionAttachmentId,
    manualAppointmentAttachmentId
  };
}

function minimizeAttachmentMetadata(value) {
  const metadata = jsonObject(value);
  return {
    storageProvider: typeof metadata?.storageProvider === "string" ? metadata.storageProvider : null,
    visibility: typeof metadata?.visibility === "string" ? metadata.visibility : null,
    paymentKind: typeof metadata?.paymentKind === "string" ? metadata.paymentKind : null,
    submissionSource: typeof metadata?.submissionSource === "string" ? metadata.submissionSource : null
  };
}

function minimizeAuditRow({ metadataJson, ...row }) {
  const metadata = jsonObject(metadataJson);
  const isPrivateSlipUpload =
    row.action === "consultation.private_slip_uploaded" &&
    row.entityType === "consultation";
  return {
    ...row,
    uploadAttachmentId:
      isPrivateSlipUpload && typeof metadata?.attachmentId === "string"
        ? metadata.attachmentId
        : null,
    uploadPaymentId:
      isPrivateSlipUpload && typeof metadata?.paymentId === "string"
        ? metadata.paymentId
        : null,
    uploadNextPaymentStatus:
      isPrivateSlipUpload && typeof metadata?.nextPaymentStatus === "string"
        ? metadata.nextPaymentStatus
        : null
  };
}

function zoomHandoffMarkers(consultations) {
  return consultations.flatMap((consultation) => [
    `zoom-handoff-ticket:v1:customer:${consultation.id}`,
    `zoom-external-session:v1:customer:${consultation.id}`,
    `zoom-handoff-ticket:v1:doctor:${consultation.id}`,
    `zoom-external-session:v1:doctor:${consultation.id}`
  ]);
}

function parseZoomHandoffMarker(value) {
  const match = /^(zoom-handoff-ticket|zoom-external-session):v1:(customer|doctor):([A-Za-z0-9_-]{8,191})$/.exec(value || "");
  return match ? { markerRole: match[2], markerConsultationId: match[3] } : null;
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

  const [liveRows, scheduledConsultations] = await Promise.all([
    db.consultation.findMany({
      where: { patientId: customer.id, status: "live" },
      select: {
        id: true,
        patientId: true,
        status: true,
        scheduledAt: true,
        slotLockId: true,
        zoomMeetingId: true,
        doctorId: true,
        updatedAt: true,
        doctor: { select: { userId: true } }
      },
      orderBy: { id: "asc" }
    }),
    db.consultation.findMany({
      where: { patientId: customer.id, status: "scheduled" },
      select: { id: true, patientId: true, status: true, scheduledAt: true, slotLockId: true, zoomMeetingId: true, updatedAt: true },
      orderBy: { id: "asc" }
    })
  ]);
  const liveConsultations = liveRows.map(({ doctor, ...consultation }) => ({
    ...consultation,
    doctorUserId: doctor.userId
  }));
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
    db.payment.findMany({
      where: { consultationId: { in: consultationIds } },
      select: { id: true, consultationId: true, verificationPayload: true, updatedAt: true }
    }),
    db.prescription.findMany({ where: { consultationId: { in: consultationIds } }, select: { id: true, consultationId: true, updatedAt: true } })
  ]);

  const paymentIds = ids(payments);
  const prescriptionIds = ids(prescriptions);
  const slotLockIds = liveConsultations.flatMap((row) => (row.slotLockId ? [row.slotLockId] : []));
  const notificationUserIds = [...new Set([customer.id, ...liveConsultations.map((row) => row.doctorUserId)])];
  const [slotLocks, attachmentRows, linkedOrderItems, notificationCandidates, zoomHandoffSessionRows] = await Promise.all([
    db.consultationSlotLock.findMany({ where: { id: { in: slotLockIds } }, select: { id: true, updatedAt: true } }),
    db.fileAttachment.findMany({
      where: {
        OR: [
          { entityId: { in: consultationIds } },
          { entityId: { in: paymentIds } },
          { entityId: { in: prescriptionIds } }
        ]
      },
      select: {
        id: true,
        ownerId: true,
        purpose: true,
        status: true,
        entityType: true,
        entityId: true,
        storageUrl: true,
        storageKey: true,
        mimeType: true,
        byteSize: true,
        metadataJson: true,
        updatedAt: true
      }
    }),
    db.orderItem.count({ where: { prescriptionId: { in: prescriptionIds } } }),
    db.notification.findMany({
      where: {
        type: { in: ["consultation", "payment", "prescription"] },
        userId: { in: notificationUserIds }
      },
      select: { id: true, userId: true, type: true, metadataJson: true, createdAt: true }
    }),
    db.authSession.findMany({
      where: { userAgent: { in: zoomHandoffMarkers(liveConsultations) } },
      select: { id: true, userId: true, userAgent: true, updatedAt: true, user: { select: { role: true } } }
    })
  ]);
  const minimizedPayments = payments.map(({ verificationPayload, ...payment }) => ({
    ...payment,
    ...minimizePaymentVerificationPayload(verificationPayload)
  }));
  const paymentByConsultation = new Map(minimizedPayments.map((payment) => [payment.consultationId, payment.id]));
  const consultationByPrescription = new Map(prescriptions.map((prescription) => [prescription.id, prescription.consultationId]));
  const scopedAttachments = attachmentRows.map(({ metadataJson, ...attachment }) => {
    const directPaymentId = paymentIds.includes(attachment.entityId) ? attachment.entityId : null;
    const consultationId = consultationIds.includes(attachment.entityId)
      ? attachment.entityId
      : consultationByPrescription.get(attachment.entityId);
    return {
      ...attachment,
      ...minimizeAttachmentMetadata(metadataJson),
      storagePaymentId: directPaymentId || paymentByConsultation.get(consultationId) || null
    };
  });
  const privateAttachments = scopedAttachments.filter(
    (attachment) => attachment.entityType === "payment_slip" && paymentIds.includes(attachment.entityId)
  );
  const otherScopedAttachments = scopedAttachments.filter(
    (attachment) => !privateAttachments.some((privateAttachment) => privateAttachment.id === attachment.id)
  );
  const consultationIdSet = new Set(consultationIds);
  const relatedNotifications = notificationCandidates.flatMap((notification) => {
    const consultationId = metadataConsultationId(notification.metadataJson);
    return consultationId && consultationIdSet.has(consultationId)
      ? [{ id: notification.id, userId: notification.userId, type: notification.type, metadataConsultationId: consultationId, createdAt: notification.createdAt }]
      : [];
  });
  const zoomHandoffSessions = zoomHandoffSessionRows.map((session) => {
    const marker = parseZoomHandoffMarker(session.userAgent);
    if (!marker) fail("ZOOM_HANDOFF_SESSION_MARKER_INVALID");
    return {
      id: session.id,
      userId: session.userId,
      userRole: session.user.role,
      userAgent: session.userAgent,
      updatedAt: session.updatedAt,
      ...marker
    };
  });
  const auditWhere = directAuditWhere({
    consultationIds,
    paymentIds,
    prescriptionIds,
    attachmentIds: ids(scopedAttachments),
    recordingIds: ids(recordings),
    recordingWebhookEventIds: ids(recordingWebhookEvents),
    attendanceCredentialIds: ids(attendanceCredentials),
    attendanceEventIds: ids(attendanceEvents),
    messageIds: ids(messages),
    consentIds: ids(telemedicineConsents),
    slotLockIds: ids(slotLocks),
    notificationIds: ids(relatedNotifications),
    zoomHandoffSessionIds: ids(zoomHandoffSessions)
  });
  const directAuditRows = (
    await db.auditLog.findMany({
      where: auditWhere,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadataJson: true,
        createdAt: true
      }
    })
  ).map(minimizeAuditRow);

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
    payments: minimizedPayments,
    prescriptions,
    slotLocks,
    privateAttachments,
    otherScopedAttachments,
    relatedNotifications,
    zoomHandoffSessions,
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
    async validate(snapshot, { recoveryMode }) {
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
        const providerIds = validateProviderRecordingSet(expectedIds, provider.ids, recoveryMode);
        state.set(consultation.id, { meetingId: consultation.zoomMeetingId, expectedIds, providerIds });
      }
    },
    async remove(snapshot) {
      if (!token) fail("ZOOM_DELETE_ADAPTER_NOT_VALIDATED");
      for (const consultation of snapshot.liveConsultations) {
        const mapping = state.get(consultation.id);
        if (!mapping) continue;
        for (const providerId of mapping.providerIds) {
          const response = await fetch(
            `https://api.zoom.us/v2/meetings/${encodeURIComponent(mapping.meetingId)}/recordings/${encodeURIComponent(providerId)}?action=delete`,
            { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) }
          );
          if (response.status !== 204 && response.status !== 404) fail("ZOOM_RECORDING_DELETE_FAILED");
        }
        const after = await listZoomRecordings(token, mapping.meetingId);
        const remaining = validateProviderRecordingSet(mapping.expectedIds, after.ids, true);
        if (remaining.length > 0) fail("ZOOM_RECORDING_DELETE_NOT_VERIFIED");
      }
    }
  };
}

function createFileAdapter(prisma) {
  const root = process.env.PAYMENT_UPLOAD_DIR;
  return {
    async validate(snapshot, { recoveryMode }) {
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
      for (const attachment of [...snapshot.privateAttachments, ...snapshot.otherScopedAttachments]) {
        const referenceCount = await prisma.fileAttachment.count({ where: { storageKey: attachment.storageKey } });
        validated.push(
          await validatePrivateAttachmentFile({
            root: storageRoot,
            snapshot,
            attachment,
            referenceCount,
            allowMissing: recoveryMode
          })
        );
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
        const attachmentIds = ids([...fresh.privateAttachments, ...fresh.otherScopedAttachments]);
        const notificationIds = ids(fresh.relatedNotifications);
        const zoomHandoffSessionIds = ids(fresh.zoomHandoffSessions);
        const auditIds = ids(fresh.directAuditRows);
        const slotLockIds = ids(fresh.slotLocks);
        const deleteExact = async (operation, expected) => {
          const result = await operation;
          if (result.count !== expected) fail("TRANSACTION_DEPENDENCY_COUNT_DRIFT");
        };

        await deleteExact(tx.auditLog.deleteMany({ where: { id: { in: auditIds } } }), fresh.directAuditRows.length);
        await deleteExact(
          tx.fileAttachment.deleteMany({ where: { id: { in: attachmentIds }, ownerId: fresh.customer.id } }),
          fresh.privateAttachments.length + fresh.otherScopedAttachments.length
        );
        await deleteExact(
          tx.notification.deleteMany({ where: { id: { in: notificationIds } } }),
          fresh.relatedNotifications.length
        );
        await deleteExact(
          tx.authSession.deleteMany({ where: { id: { in: zoomHandoffSessionIds } } }),
          fresh.zoomHandoffSessions.length
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
      const paymentIds = ids(snapshot.payments);
      const prescriptionIds = ids(snapshot.prescriptions);
      const notificationUserIds = [
        ...new Set([snapshot.customer.id, ...snapshot.liveConsultations.map((row) => row.doctorUserId)])
      ];
      const auditEntityIds = ids([
        ...snapshot.liveConsultations,
        ...snapshot.attendanceCredentials,
        ...snapshot.attendanceEvents,
        ...snapshot.messages,
        ...snapshot.recordings,
        ...snapshot.recordingWebhookEvents,
        ...snapshot.telemedicineConsents,
        ...snapshot.payments,
        ...snapshot.prescriptions,
        ...snapshot.slotLocks,
        ...snapshot.privateAttachments,
        ...snapshot.otherScopedAttachments,
        ...snapshot.relatedNotifications,
        ...snapshot.zoomHandoffSessions
      ]);
      const notificationCandidates = await prisma.notification.findMany({
        where: {
          type: { in: ["consultation", "payment", "prescription"] },
          userId: { in: notificationUserIds }
        },
        select: { metadataJson: true }
      });
      const relatedNotificationCount = notificationCandidates.filter((notification) =>
        consultationIds.includes(metadataConsultationId(notification.metadataJson))
      ).length;
      const [remainingLiveConsultations, scheduledConsultations, totalScheduledConsultations, customerExists, scoped] = await Promise.all([
        prisma.consultation.count({ where: { id: { in: consultationIds }, patientId: snapshot.customer.id, status: "live" } }),
        prisma.consultation.count({
          where: {
            id: { in: ids(snapshot.scheduledConsultations) },
            patientId: snapshot.customer.id,
            status: "scheduled"
          }
        }),
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
          prisma.fileAttachment.count({
            where: {
              OR: [
                { entityId: { in: consultationIds } },
                { entityId: { in: paymentIds } },
                { entityId: { in: prescriptionIds } }
              ]
            }
          }),
          prisma.authSession.count({ where: { userAgent: { in: zoomHandoffMarkers(snapshot.liveConsultations) } } }),
          Promise.resolve(relatedNotificationCount),
          prisma.auditLog.count({ where: { entityId: { in: auditEntityIds } } }),
          prisma.consultationSlotLock.count({ where: { id: { in: ids(snapshot.slotLocks) } } })
        ])
      ]);
      return {
        remainingLiveConsultations,
        scheduledConsultations,
        totalScheduledConsultations,
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
      resume: args.resume,
      expectedCounts: parseExpectedCounts(args["expected-counts"]),
      backupGate: {
        verified: process.env.ADMIN_PURGE_BACKUP_VERIFIED === "true",
        reference: process.env.ADMIN_PURGE_BACKUP_REFERENCE,
        createdAt: process.env.ADMIN_PURGE_BACKUP_CREATED_AT
      },
      fileBackupGate: {
        verified: process.env.ADMIN_PURGE_FILE_BACKUP_VERIFIED === "true",
        reference: process.env.ADMIN_PURGE_FILE_BACKUP_REFERENCE,
        createdAt: process.env.ADMIN_PURGE_FILE_BACKUP_CREATED_AT
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

module.exports = {
  buildSnapshot,
  createDatabaseAdapter,
  createFileAdapter,
  createZoomAdapter,
  metadataConsultationId,
  minimizeAttachmentMetadata,
  minimizeAuditRow,
  minimizePaymentVerificationPayload,
  parseArguments,
  parseExpectedCounts,
  parseZoomHandoffMarker,
  zoomHandoffMarkers
};
