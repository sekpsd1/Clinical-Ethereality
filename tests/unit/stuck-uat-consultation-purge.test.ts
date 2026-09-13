import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// The operator core stays CommonJS so production can execute it with plain Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const purge = require("../../scripts/lib/stuck-uat-consultation-purge.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runner = require("../../scripts/purge-stuck-uat-consultations.cjs");

function row(id: string, consultationId = "live-1") {
  return { id, consultationId, updatedAt: new Date("2026-09-13T00:00:00.000Z") };
}

function makeSnapshot() {
  const customerId = "sensitive-customer-id";
  const liveConsultations = [1, 2, 3].map((number) => ({
    id: `live-${number}`,
    patientId: customerId,
    status: "live",
    scheduledAt: new Date(`2026-09-${number < 3 ? "10" : "11"}T03:00:00.000Z`),
    slotLockId: `lock-${number}`,
    zoomMeetingId: `meeting-${number}`,
    doctorId: `doctor-${number}`,
    doctorUserId: `doctor-user-${number}`,
    updatedAt: new Date("2026-09-13T00:00:00.000Z")
  }));
  return {
    customer: { id: customerId, role: "customer", updatedAt: new Date("2026-09-13T00:00:00.000Z") },
    liveConsultations,
    scheduledConsultations: [1, 2].map((number) => ({
      id: `scheduled-${number}`,
      patientId: customerId,
      status: "scheduled",
      scheduledAt: new Date(`2026-09-${20 + number}T03:00:00.000Z`),
      slotLockId: `scheduled-lock-${number}`,
      zoomMeetingId: null,
      updatedAt: new Date("2026-09-13T00:00:00.000Z")
    })),
    attendanceCredentials: Array.from({ length: 11 }, (_, index) => row(`credential-${index}`, `live-${(index % 3) + 1}`)),
    attendanceEvents: [],
    messages: [] as ReturnType<typeof row>[],
    recordings: Array.from({ length: 15 }, (_, index) => ({
      ...row(`recording-${index}`, `live-${(index % 3) + 1}`),
      provider: "zoom",
      providerRecordingId: `provider-${index}`
    })),
    recordingWebhookEvents: Array.from({ length: 5 }, (_, index) => row(`webhook-${index}`, `live-${(index % 3) + 1}`)),
    telemedicineConsents: [1, 2, 3].map((number) => row(`consent-${number}`, `live-${number}`)),
    payments: [1, 2, 3].map((number) => ({
      ...row(`payment-${number}`, `live-${number}`),
      privateFileSubmissionAttachmentId: null as string | null,
      manualAppointmentAttachmentId: null as string | null
    })),
    prescriptions: [],
    slotLocks: [1, 2, 3].map((number) => ({ id: `lock-${number}`, updatedAt: new Date("2026-09-13T00:00:00.000Z") })),
    privateAttachments: [1, 2, 3].map((number) => ({
      id: `attachment-${number}`,
      ownerId: customerId,
      purpose: "payment_slip",
      entityType: "payment_slip",
      entityId: `payment-${number}`,
      storagePaymentId: `payment-${number}`,
      storageUrl: `/api/payments/slips/attachment-${number}`,
      storageKey: purge.expectedStorageKey(customerId, `payment-${number}`, `attachment-${number}`, "png"),
      mimeType: "image/png",
      byteSize: 8,
      storageProvider: "plesk_private_local",
      visibility: "private",
      paymentKind: "consultation",
      submissionSource: null as string | null,
      updatedAt: new Date("2026-09-13T00:00:00.000Z")
    })),
    otherScopedAttachments: [] as Array<{
      id: string;
      ownerId: string;
      purpose: string;
      entityType: string;
      entityId: string;
      storagePaymentId: string;
      storageUrl: string;
      storageKey: string;
      mimeType: string;
      byteSize: number;
      storageProvider: string;
      visibility: string;
      paymentKind: string;
      submissionSource: string | null;
      updatedAt: Date;
    }>,
    relatedNotifications: [] as Array<{
      id: string;
      userId: string;
      type: string;
      metadataConsultationId: string;
    }>,
    zoomHandoffSessions: [] as Array<{
      id: string;
      userId: string;
      userRole: string;
      markerRole: string;
      markerConsultationId: string;
    }>,
    directAuditRows: Array.from({ length: 65 }, (_, index) => ({ id: `audit-${index}`, entityType: "consultation", entityId: `live-${(index % 3) + 1}` })),
    linkedOrderItems: 0
  };
}

function harness(snapshot = makeSnapshot()) {
  const expectedCounts = purge.aggregateSnapshot(snapshot);
  const fingerprint = purge.fingerprintSnapshot(snapshot);
  const calls: string[] = [];
  return {
    expectedCounts,
    fingerprint,
    calls,
    input: {
      snapshot,
      execute: true,
      confirmation: fingerprint,
      expectedCounts,
      backupGate: { verified: true, reference: "backup-opaque-reference", createdAt: "2026-09-13T00:00:00.000Z" },
      fileBackupGate: { verified: true, reference: "file-backup-opaque-reference", createdAt: "2026-09-13T00:00:00.000Z" },
      now: new Date("2026-09-13T00:10:00.000Z"),
      reinspect: vi.fn(async () => snapshot),
      provider: {
        validate: vi.fn(async () => calls.push("provider.validate")),
        remove: vi.fn(async () => calls.push("provider.remove"))
      },
      files: {
        validate: vi.fn(async () => { calls.push("files.validate"); return ["validated"]; }),
        remove: vi.fn(async () => calls.push("files.remove"))
      },
      database: {
        remove: vi.fn(async () => calls.push("database.remove")),
        verify: vi.fn(async () => ({
          remainingLiveConsultations: 0,
          remainingScopedDependencies: 0,
          scheduledConsultations: 2,
          totalScheduledConsultations: 2,
          customerExists: true
        }))
      }
    }
  };
}

describe("stuck UAT consultation purge guard", () => {
  it("parses an invocation with no flags as dry-run", () => {
    expect(runner.parseArguments([])).toEqual({ execute: false });
  });

  it("matches only exact structured notification references and Zoom handoff markers", () => {
    expect(runner.metadataConsultationId({ consultationId: "live-1", href: "/consult/live" })).toBe("live-1");
    expect(runner.metadataConsultationId({ href: "/consult/live?consultation=live-1" })).toBeNull();
    expect(runner.metadataConsultationId({ nested: { consultationId: "live-1" } })).toBeNull();
    expect(runner.parseZoomHandoffMarker("zoom-handoff-ticket:v1:customer:live-1234")).toEqual({
      markerRole: "customer",
      markerConsultationId: "live-1234"
    });
    expect(runner.parseZoomHandoffMarker("Mozilla/5.0 normal login session")).toBeNull();
    expect(runner.parseZoomHandoffMarker("zoom-handoff-ticket:v1:admin:live-1234")).toBeNull();
  });

  it("minimizes only exact application-generated payment and attachment markers", () => {
    expect(runner.minimizePaymentVerificationPayload({
      submissionSource: "private_file",
      submittedEvidence: {
        attachmentId: "attachment-1",
        submittedAt: "2026-09-13T00:00:00.000Z",
        type: "private_file"
      },
      manualAppointmentIntake: {
        version: 1,
        source: "admin_manual_appointment",
        attachmentId: "attachment-2",
        createdAt: "2026-09-13T00:00:00.000Z",
        createdById: "admin-1",
        reasonCode: "provider_unavailable",
        transferredAt: "2026-09-12T23:00:00.000Z"
      }
    })).toEqual({
      privateFileSubmissionAttachmentId: "attachment-1",
      manualAppointmentAttachmentId: "attachment-2"
    });
    expect(runner.minimizePaymentVerificationPayload({
      submissionSource: "private_file",
      submittedEvidence: { attachmentId: "attachment-1", type: "url" },
      manualAppointmentIntake: { version: 2, source: "admin_manual_appointment", attachmentId: "attachment-2" }
    })).toEqual({ privateFileSubmissionAttachmentId: null, manualAppointmentAttachmentId: null });
    expect(runner.minimizeAttachmentMetadata({
      storageProvider: "plesk_private_local",
      visibility: "private",
      paymentKind: "consultation",
      submissionSource: "admin_manual_appointment",
      ignored: "raw-value"
    })).toEqual({
      storageProvider: "plesk_private_local",
      visibility: "private",
      paymentKind: "consultation",
      submissionSource: "admin_manual_appointment"
    });
  });

  it("accepts exactly the three application-generated private payment paths", () => {
    const canonical = makeSnapshot();
    expect(() => purge.assertSnapshot(canonical)).not.toThrow();

    const consultationProvisional = makeSnapshot();
    consultationProvisional.payments[0].privateFileSubmissionAttachmentId = "attachment-1";
    consultationProvisional.privateAttachments[0].storageKey = purge.expectedStorageKey(
      consultationProvisional.customer.id,
      "consultation-live-1",
      "attachment-1",
      "png"
    );
    expect(() => purge.assertSnapshot(consultationProvisional)).not.toThrow();

    const manualAppointment = makeSnapshot();
    manualAppointment.payments[0].manualAppointmentAttachmentId = "attachment-1";
    manualAppointment.privateAttachments[0].submissionSource = "admin_manual_appointment";
    manualAppointment.privateAttachments[0].storageKey = purge.expectedStorageKey(
      manualAppointment.customer.id,
      `manual-appointment:${manualAppointment.liveConsultations[0].doctorId}:${manualAppointment.liveConsultations[0].scheduledAt.toISOString()}`,
      "attachment-1",
      "png"
    );
    expect(() => purge.assertSnapshot(manualAppointment)).not.toThrow();
  });

  it("rejects forged or mismatched private payment path bindings", () => {
    const manualSnapshot = () => {
      const snapshot = makeSnapshot();
      snapshot.payments[0].manualAppointmentAttachmentId = "attachment-1";
      snapshot.privateAttachments[0].submissionSource = "admin_manual_appointment";
      snapshot.privateAttachments[0].storageKey = purge.expectedStorageKey(
        snapshot.customer.id,
        `manual-appointment:${snapshot.liveConsultations[0].doctorId}:${snapshot.liveConsultations[0].scheduledAt.toISOString()}`,
        "attachment-1",
        "png"
      );
      return snapshot;
    };

    for (const mutate of [
      (snapshot: ReturnType<typeof makeSnapshot>) => { snapshot.payments[0].consultationId = "live-2"; },
      (snapshot: ReturnType<typeof makeSnapshot>) => {
        snapshot.privateAttachments[0].entityId = "payment-2";
        snapshot.privateAttachments[0].storagePaymentId = "payment-2";
      },
      (snapshot: ReturnType<typeof makeSnapshot>) => { snapshot.payments[0].manualAppointmentAttachmentId = "attachment-forged"; },
      (snapshot: ReturnType<typeof makeSnapshot>) => { snapshot.liveConsultations[0].doctorId = "doctor-forged"; },
      (snapshot: ReturnType<typeof makeSnapshot>) => { snapshot.liveConsultations[0].scheduledAt = new Date("2026-09-10T04:00:00.000Z"); },
      (snapshot: ReturnType<typeof makeSnapshot>) => { snapshot.privateAttachments[0].storageKey = "payments/forged/path.png"; }
    ]) {
      const snapshot = manualSnapshot();
      mutate(snapshot);
      expect(() => purge.assertSnapshot(snapshot)).toThrowError(
        expect.objectContaining({ code: "PRIVATE_FILE_OWNERSHIP_INVALID" })
      );
    }

    const metadataMismatch = makeSnapshot();
    metadataMismatch.privateAttachments[0].storageProvider = "public";
    expect(() => purge.assertSnapshot(metadataMismatch)).toThrowError(
      expect.objectContaining({ code: "PRIVATE_FILE_METADATA_INVALID" })
    );

    const storageUrlMismatch = makeSnapshot();
    storageUrlMismatch.privateAttachments[0].storageUrl = "/api/payments/slips/attachment-forged";
    expect(() => purge.assertSnapshot(storageUrlMismatch)).toThrowError(
      expect.objectContaining({ code: "PRIVATE_FILE_STORAGE_URL_INVALID" })
    );

    const missingConsultationMarker = makeSnapshot();
    missingConsultationMarker.privateAttachments[0].storageKey = purge.expectedStorageKey(
      missingConsultationMarker.customer.id,
      "consultation-live-1",
      "attachment-1",
      "png"
    );
    expect(() => purge.assertSnapshot(missingConsultationMarker)).toThrowError(
      expect.objectContaining({ code: "PRIVATE_FILE_OWNERSHIP_INVALID" })
    );

    const ambiguousContext = makeSnapshot();
    ambiguousContext.payments[0].id = "consultation-live-1";
    ambiguousContext.payments[0].privateFileSubmissionAttachmentId = "attachment-1";
    ambiguousContext.privateAttachments[0].entityId = "consultation-live-1";
    ambiguousContext.privateAttachments[0].storagePaymentId = "consultation-live-1";
    ambiguousContext.privateAttachments[0].storageKey = purge.expectedStorageKey(
      ambiguousContext.customer.id,
      "consultation-live-1",
      "attachment-1",
      "png"
    );
    expect(() => purge.assertSnapshot(ambiguousContext)).toThrowError(
      expect.objectContaining({ code: "PRIVATE_FILE_OWNERSHIP_INVALID" })
    );
  });

  it("is dry-run by default and exposes aggregate-only output", async () => {
    const snapshot = makeSnapshot();
    const state = harness(snapshot);
    const result = await purge.executePurge({ ...state.input, execute: false, confirmation: undefined, expectedCounts: null });
    const serialized = JSON.stringify(result);

    expect(result.mode).toBe("dry-run");
    expect(result.counts.liveConsultations).toBe(3);
    expect(result.counts.scheduledConsultations).toBe(2);
    expect(result.counts.liveConsultationDays).toBe(2);
    expect(serialized).not.toContain(snapshot.customer.id);
    expect(serialized).not.toContain(snapshot.liveConsultations[0].id);
    expect(serialized).not.toContain(snapshot.privateAttachments[0].storageKey);
    expect(state.input.provider.validate).not.toHaveBeenCalled();
  });

  it("rejects fingerprint and expected-count drift", async () => {
    const state = harness();
    await expect(purge.executePurge({ ...state.input, confirmation: "0".repeat(64) })).rejects.toMatchObject({ code: "FINGERPRINT_CONFIRMATION_REQUIRED" });
    await expect(purge.executePurge({ ...state.input, expectedCounts: { ...state.expectedCounts, recordings: 14 } })).rejects.toMatchObject({ code: "EXPECTED_COUNTS_DRIFT" });

    const drifted = structuredClone(state.input.snapshot);
    drifted.recordings.pop();
    await expect(purge.executePurge({ ...state.input, reinspect: async () => drifted })).rejects.toMatchObject({ code: "FINGERPRINT_DRIFT" });
  });

  it("rejects cross-customer, non-live, and scheduled-set changes", () => {
    const crossCustomer = makeSnapshot();
    crossCustomer.liveConsultations[0].patientId = "another-customer";
    expect(() => purge.assertSnapshot(crossCustomer)).toThrowError(expect.objectContaining({ code: "CROSS_CUSTOMER_CONSULTATION" }));

    const nonLive = makeSnapshot();
    nonLive.liveConsultations[0].status = "completed";
    expect(() => purge.assertSnapshot(nonLive)).toThrowError(expect.objectContaining({ code: "NON_LIVE_TARGET" }));

    const scheduledMissing = makeSnapshot();
    scheduledMissing.scheduledConsultations.pop();
    expect(() => purge.assertSnapshot(scheduledMissing)).toThrowError(expect.objectContaining({ code: "SCHEDULED_COUNT_MISMATCH" }));
  });

  it("rejects a dependency outside the three live consultations", () => {
    const snapshot = makeSnapshot();
    snapshot.messages.push(row("message-outside", "scheduled-1"));
    expect(() => purge.assertSnapshot(snapshot)).toThrowError(expect.objectContaining({ code: "DEPENDENCY_SCOPE_VIOLATION" }));
  });

  it("accepts only exact notification recipients/types and Zoom handoff session markers", () => {
    const snapshot = makeSnapshot();
    snapshot.relatedNotifications.push({
      id: "notification-1",
      userId: snapshot.customer.id,
      type: "consultation",
      metadataConsultationId: "live-1"
    });
    snapshot.zoomHandoffSessions.push({
      id: "handoff-1",
      userId: "doctor-user-1",
      userRole: "doctor",
      markerRole: "doctor",
      markerConsultationId: "live-1"
    });
    expect(() => purge.assertSnapshot(snapshot)).not.toThrow();

    snapshot.relatedNotifications[0].userId = "unrelated-user";
    expect(() => purge.assertSnapshot(snapshot)).toThrowError(expect.objectContaining({ code: "NOTIFICATION_SCOPE_VIOLATION" }));
    snapshot.relatedNotifications[0].userId = snapshot.customer.id;
    snapshot.zoomHandoffSessions[0].markerConsultationId = "scheduled-1";
    expect(() => purge.assertSnapshot(snapshot)).toThrowError(expect.objectContaining({ code: "ZOOM_HANDOFF_SESSION_SCOPE_VIOLATION" }));
  });

  it("fails closed for an unsupported directly scoped attachment", () => {
    const snapshot = makeSnapshot();
    snapshot.otherScopedAttachments.push({
      ...snapshot.privateAttachments[0],
      id: "other-attachment",
      purpose: "clinical_image"
    });
    expect(() => purge.assertSnapshot(snapshot)).toThrowError(expect.objectContaining({ code: "PRIVATE_ATTACHMENT_SCOPE_VIOLATION" }));
  });

  it("rejects path traversal, incorrect ownership, and shared private files", async () => {
    expect(() => purge.resolvePrivatePath(path.resolve("safe-root"), "../escape.png")).toThrowError(expect.objectContaining({ code: "PRIVATE_FILE_PATH_ESCAPE" }));

    const snapshot = makeSnapshot();
    const attachment = snapshot.privateAttachments[0];
    attachment.storageKey = purge.expectedStorageKey(attachment.ownerId, attachment.entityId, attachment.id, "png");
    await expect(purge.validatePrivateAttachmentFile({ root: path.resolve("safe-root"), snapshot, attachment, referenceCount: 2 })).rejects.toMatchObject({ code: "PRIVATE_FILE_NOT_EXCLUSIVE" });

    attachment.storageKey = purge.expectedStorageKey("wrong-owner", attachment.entityId, attachment.id, "png");
    await expect(purge.validatePrivateAttachmentFile({ root: path.resolve("safe-root"), snapshot, attachment, referenceCount: 1 })).rejects.toMatchObject({ code: "PRIVATE_FILE_OWNERSHIP_INVALID" });
  });

  it("checks private-file image magic before allowing deletion", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "clinical-purge-test-"));
    const snapshot = makeSnapshot();
    const attachment = snapshot.privateAttachments[0];
    attachment.storageKey = purge.expectedStorageKey(attachment.ownerId, attachment.entityId, attachment.id, "png");
    const filePath = purge.resolvePrivatePath(root, attachment.storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    try {
      await writeFile(filePath, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      await expect(purge.validatePrivateAttachmentFile({ root, snapshot, attachment, referenceCount: 1 })).resolves.toMatchObject({ alreadyAbsent: false });
      await writeFile(filePath, Buffer.from("not-png!"));
      await expect(purge.validatePrivateAttachmentFile({ root, snapshot, attachment, referenceCount: 1 })).rejects.toMatchObject({ code: "PRIVATE_FILE_MAGIC_MISMATCH" });
    } finally {
      expect(path.resolve(root).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)).toBe(true);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires recovery mode for a missing private file", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "clinical-purge-test-"));
    const snapshot = makeSnapshot();
    const attachment = snapshot.privateAttachments[0];
    attachment.storageKey = purge.expectedStorageKey(attachment.ownerId, attachment.entityId, attachment.id, "png");
    try {
      await expect(purge.validatePrivateAttachmentFile({ root, snapshot, attachment, referenceCount: 1 })).rejects.toMatchObject({ code: "PRIVATE_FILE_MISSING_WITHOUT_RESUME" });
      await expect(purge.validatePrivateAttachmentFile({ root, snapshot, attachment, referenceCount: 1, allowMissing: true })).resolves.toMatchObject({ alreadyAbsent: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires recovery mode for partial provider state and rejects unexpected IDs", () => {
    expect(() => purge.validateProviderRecordingSet(["one", "two"], ["one"], false)).toThrowError(expect.objectContaining({ code: "ZOOM_RECORDING_MISSING_WITHOUT_RESUME" }));
    expect(purge.validateProviderRecordingSet(["one", "two"], ["one"], true)).toEqual(["one"]);
    expect(() => purge.validateProviderRecordingSet(["one", "two"], ["unexpected"], true)).toThrowError(expect.objectContaining({ code: "ZOOM_RECORDING_MAPPING_DRIFT" }));
  });

  it("binds recovery mode to the exact confirmed fingerprint", async () => {
    const state = harness();
    await expect(purge.executePurge({ ...state.input, resume: "0".repeat(64) })).rejects.toMatchObject({ code: "RESUME_FINGERPRINT_MISMATCH" });

    const recovery = harness();
    const result = await purge.executePurge({ ...recovery.input, resume: recovery.fingerprint });
    expect(result).toMatchObject({ mode: "executed", verified: true });
    expect(recovery.input.provider.validate).toHaveBeenCalledWith(recovery.input.snapshot, { recoveryMode: true });
    expect(recovery.input.files.validate).toHaveBeenCalledWith(recovery.input.snapshot, { recoveryMode: true });
  });

  it("fails closed before files and DB when provider validation fails", async () => {
    const state = harness();
    state.input.provider.validate = vi.fn(async () => { throw new Error("provider unavailable"); });
    await expect(purge.executePurge(state.input)).rejects.toThrow("provider unavailable");
    expect(state.input.files.remove).not.toHaveBeenCalled();
    expect(state.input.database.remove).not.toHaveBeenCalled();
  });

  it("reports a transaction failure after provider/files and resumes with the same fingerprint", async () => {
    const state = harness();
    state.input.database.remove = vi.fn().mockRejectedValueOnce(new Error("transaction failed")).mockImplementationOnce(async () => state.calls.push("database.remove"));
    await expect(purge.executePurge(state.input)).rejects.toThrow("transaction failed");
    expect(state.calls).toEqual(["provider.validate", "files.validate", "provider.remove", "files.remove"]);

    state.calls.length = 0;
    await expect(purge.executePurge({ ...state.input, resume: state.fingerprint })).resolves.toMatchObject({
      mode: "executed",
      verified: true,
      recoveryMode: true
    });
    expect(state.calls).toEqual(["provider.validate", "files.validate", "provider.remove", "files.remove", "database.remove"]);
  });

  it("requires a fresh verified backup and verifies preservation after deletion", async () => {
    const state = harness();
    await expect(purge.executePurge({ ...state.input, backupGate: { verified: false } })).rejects.toMatchObject({ code: "VERIFIED_BACKUP_REQUIRED" });
    await expect(purge.executePurge({
      ...state.input,
      backupGate: { verified: true, reference: "backup-opaque-reference", createdAt: "2026-09-12T00:00:00.000Z" }
    })).rejects.toMatchObject({ code: "FRESH_BACKUP_REQUIRED" });

    state.input.database.verify = vi.fn(async () => ({
      remainingLiveConsultations: 0,
      remainingScopedDependencies: 0,
      scheduledConsultations: 1,
      totalScheduledConsultations: 1,
      customerExists: true
    }));
    await expect(purge.executePurge(state.input)).rejects.toMatchObject({ code: "POST_PURGE_VERIFICATION_FAILED" });
  });

  it("uses a deterministic opaque fingerprint", () => {
    const snapshot = makeSnapshot();
    const fingerprint = purge.fingerprintSnapshot(snapshot);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(purge.fingerprintSnapshot(structuredClone(snapshot))).toBe(fingerprint);
  });
});
