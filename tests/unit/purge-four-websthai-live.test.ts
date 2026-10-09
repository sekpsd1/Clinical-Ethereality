import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const core = require("../../scripts/lib/stuck-uat-consultation-purge.cjs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runner = require("../../scripts/purge-four-websthai-live.cjs");

function snapshot() {
  const customerId = "customer-test-id";
  const days = ["16", "17", "18", "18"];
  return {
    customer: { id: customerId, role: "customer", status: "active" },
    liveConsultations: days.map((day, index) => ({
      id: `live-${index + 1}`,
      patientId: customerId,
      doctorId: `doctor-${index + 1}`,
      doctorUserId: `doctor-user-${index + 1}`,
      status: "live",
      scheduledAt: new Date(`2026-09-${day}T03:00:00.000Z`),
      slotLockId: null,
      zoomMeetingId: `meeting-${index + 1}`
    })),
    scheduledConsultations: [{
      id: "scheduled-1", patientId: customerId, status: "scheduled",
      scheduledAt: new Date("2026-10-10T03:00:00.000Z")
    }],
    attendanceCredentials: [], attendanceEvents: [], messages: [],
    recordings: [] as Array<{ id: string; consultationId: string; provider: string; archiveStatus: string }>,
    recordingWebhookEvents: [], telemedicineConsents: [],
    payments: [] as Array<{ id: string; consultationId: string; orderId: string | null; status: string }>,
    prescriptions: [],
    slotLocks: [], privateAttachments: [], otherScopedAttachments: [], relatedNotifications: [],
    zoomHandoffSessions: [], directAuditRows: [], linkedOrderItems: 0
  };
}

describe("four Websthai live purge guard", () => {
  it("requires exactly four live consultations across the three approved Bangkok dates", () => {
    expect(core.assertSnapshot(snapshot(), runner.SNAPSHOT_POLICY)).toBeTruthy();
    const wrongDate = snapshot();
    wrongDate.liveConsultations[3].scheduledAt = new Date("2026-09-19T03:00:00.000Z");
    expect(() => core.assertSnapshot(wrongDate, runner.SNAPSHOT_POLICY)).toThrow(/LIVE_(DAY_COUNT|DATE_SET)_MISMATCH/);
    const wrongCount = snapshot();
    wrongCount.liveConsultations.pop();
    expect(() => core.assertSnapshot(wrongCount, runner.SNAPSHOT_POLICY)).toThrow("LIVE_COUNT_MISMATCH");
  });

  it("rejects a consultation payment linked to an order", () => {
    const value = snapshot();
    value.payments.push({ id: "payment-1", consultationId: "live-1", orderId: "order-1", status: "paid" });
    expect(() => core.assertSnapshot(value, runner.SNAPSHOT_POLICY)).toThrow("PAYMENT_HAS_ORDER_DEPENDENCY");
  });

  it("reports only aggregate payment and archive states", () => {
    const value = snapshot();
    value.payments.push(
      { id: "payment-1", consultationId: "live-1", orderId: null, status: "paid" },
      { id: "payment-2", consultationId: "live-2", orderId: null, status: "paid" },
      { id: "payment-3", consultationId: "live-3", orderId: null, status: "pending_review" }
    );
    value.recordings.push(
      { id: "recording-1", consultationId: "live-1", provider: "zoom", archiveStatus: "archived" },
      { id: "recording-2", consultationId: "live-1", provider: "zoom", archiveStatus: "pending" }
    );
    expect(runner.paymentStatusCounts(value)).toEqual({ paid: 2, pending_review: 1 });
    expect(runner.archiveStatusCounts(value)).toEqual({ archived: 1, pending: 1 });
    expect(runner.databaseBoundaryHash("mysql://user:secret@db.example.test:3306/clinical")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("imports only the allowlisted runtime keys from a process environment", () => {
    const parsed = runner.parseProcessEnvironment(Buffer.from(
      "DATABASE_URL=mysql://user:secret@127.0.0.1/db\0NODE_ENV=production\0JWT_SECRET=must-not-import\0"
    ));
    expect(parsed).toEqual({
      DATABASE_URL: "mysql://user:secret@127.0.0.1/db",
      NODE_ENV: "production"
    });
  });

  it("verifies preservation adapters after the database transaction without deleting external files", async () => {
    const value = snapshot();
    const counts = core.aggregateSnapshot(value);
    const fingerprint = core.fingerprintSnapshot(value);
    const calls: string[] = [];
    const provider = {
      validate: vi.fn(async () => calls.push("provider.validate")),
      remove: vi.fn(async () => calls.push("provider.noop")),
      verifyPreserved: vi.fn(async () => calls.push("provider.verify"))
    };
    const files = {
      validate: vi.fn(async () => { calls.push("files.validate"); return []; }),
      remove: vi.fn(async () => calls.push("files.noop")),
      verifyPreserved: vi.fn(async () => calls.push("files.verify"))
    };
    const database = {
      remove: vi.fn(async () => calls.push("database.remove")),
      verify: vi.fn(async () => ({
        remainingLiveConsultations: 0,
        remainingScopedDependencies: 0,
        scheduledConsultations: 1,
        totalScheduledConsultations: 1,
        customerExists: true
      }))
    };
    const result = await core.executePurge({
      snapshot: value,
      snapshotPolicy: runner.SNAPSHOT_POLICY,
      execute: true,
      confirmation: fingerprint,
      expectedCounts: counts,
      backupGate: { verified: true, reference: "backup-reference", createdAt: "2026-10-09T03:00:00.000Z" },
      fileBackupGate: { verified: true, reference: "backup-reference", createdAt: "2026-10-09T03:00:00.000Z" },
      now: new Date("2026-10-09T03:10:00.000Z"),
      reinspect: vi.fn(async () => value),
      provider,
      files,
      database
    });
    expect(result).toMatchObject({ mode: "executed", verified: true });
    expect(calls).toEqual([
      "provider.validate", "files.validate", "provider.noop", "files.noop",
      "database.remove", "provider.verify", "files.verify"
    ]);
  });
});
