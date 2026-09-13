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
    payments: [1, 2, 3].map((number) => row(`payment-${number}`, `live-${number}`)),
    prescriptions: [],
    slotLocks: [1, 2, 3].map((number) => ({ id: `lock-${number}`, updatedAt: new Date("2026-09-13T00:00:00.000Z") })),
    privateAttachments: [1, 2, 3].map((number) => ({
      id: `attachment-${number}`,
      ownerId: customerId,
      purpose: "payment_slip",
      entityType: "payment_slip",
      entityId: `payment-${number}`,
      storageKey: `opaque-${number}`,
      mimeType: "image/png",
      byteSize: 8,
      updatedAt: new Date("2026-09-13T00:00:00.000Z")
    })),
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

  it("rejects path traversal, incorrect ownership, and shared private files", async () => {
    expect(() => purge.resolvePrivatePath(path.resolve("safe-root"), "../escape.png")).toThrowError(expect.objectContaining({ code: "PRIVATE_FILE_PATH_ESCAPE" }));

    const snapshot = makeSnapshot();
    const attachment = snapshot.privateAttachments[0];
    attachment.storageKey = purge.expectedStorageKey(attachment.ownerId, attachment.entityId, attachment.id, "png");
    await expect(purge.validatePrivateAttachmentFile({ root: path.resolve("safe-root"), attachment, referenceCount: 2 })).rejects.toMatchObject({ code: "PRIVATE_FILE_NOT_EXCLUSIVE" });

    attachment.storageKey = purge.expectedStorageKey("wrong-owner", attachment.entityId, attachment.id, "png");
    await expect(purge.validatePrivateAttachmentFile({ root: path.resolve("safe-root"), attachment, referenceCount: 1 })).rejects.toMatchObject({ code: "PRIVATE_FILE_OWNERSHIP_INVALID" });
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
      await expect(purge.validatePrivateAttachmentFile({ root, attachment, referenceCount: 1 })).resolves.toMatchObject({ alreadyAbsent: false });
      await writeFile(filePath, Buffer.from("not-png!"));
      await expect(purge.validatePrivateAttachmentFile({ root, attachment, referenceCount: 1 })).rejects.toMatchObject({ code: "PRIVATE_FILE_MAGIC_MISMATCH" });
    } finally {
      expect(path.resolve(root).startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)).toBe(true);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed before files and DB when provider validation fails", async () => {
    const state = harness();
    state.input.provider.validate = vi.fn(async () => { throw new Error("provider unavailable"); });
    await expect(purge.executePurge(state.input)).rejects.toThrow("provider unavailable");
    expect(state.input.files.remove).not.toHaveBeenCalled();
    expect(state.input.database.remove).not.toHaveBeenCalled();
  });

  it("reports a transaction failure after provider/files and supports a clean retry", async () => {
    const state = harness();
    state.input.database.remove = vi.fn().mockRejectedValueOnce(new Error("transaction failed")).mockImplementationOnce(async () => state.calls.push("database.remove"));
    await expect(purge.executePurge(state.input)).rejects.toThrow("transaction failed");
    expect(state.calls).toEqual(["provider.validate", "files.validate", "provider.remove", "files.remove"]);

    state.calls.length = 0;
    await expect(purge.executePurge(state.input)).resolves.toMatchObject({ mode: "executed", verified: true });
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
