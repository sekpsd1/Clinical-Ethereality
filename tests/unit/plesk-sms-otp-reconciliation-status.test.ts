/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import { describe, expect, it } from "vitest";
const {
  RECONCILIATION_STATUS_RELATIVE_PATH,
  SAFE_RECONCILIATION_EVENTS,
  SAFE_RECONCILIATION_REASON_COMPONENTS,
  SAFE_RECONCILIATION_USER_COLUMNS_REASON_DETAILS,
  SAFE_RECONCILIATION_USER_TABLE_REASON_DETAILS,
  getSafeReconciliationEvent,
  writePleskSmsOtpReconciliationStatus
} = require("../../scripts/plesk-sms-otp-reconciliation-status.cjs");

function withTemporaryRoot(run: (rootDir: string) => void) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-otp-reconciliation-status-"));

  try {
    run(rootDir);
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
}

describe("Plesk SMS OTP reconciliation private status", () => {
  it("writes only an allowlisted safe completion payload outside the public root", () => {
    withTemporaryRoot((rootDir) => {
      const destination = writePleskSmsOtpReconciliationStatus({
        rootDir,
        eventName: "complete_ready",
        now: () => new Date("2026-08-26T12:34:56.000Z")
      });
      const serialized = fs.readFileSync(destination, "utf8");

      expect(path.relative(rootDir, destination)).toBe(RECONCILIATION_STATUS_RELATIVE_PATH);
      expect(RECONCILIATION_STATUS_RELATIVE_PATH.startsWith("runtime-private")).toBe(true);
      expect(JSON.parse(serialized)).toEqual({
        version: 1,
        component: "sms_otp_schema_reconciliation",
        stage: "complete",
        status: "ready",
        action: "remove_target_and_restart",
        updatedAt: "2026-08-26T12:34:56.000Z"
      });
      expect(serialized).not.toContain("DATABASE_URL");
      expect(serialized).not.toContain("private-password");
      expect(serialized).not.toContain("PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET");
      expect(fs.readdirSync(path.dirname(destination))).toEqual([
        "sms-otp-schema-reconciliation-status.json"
      ]);
    });
  });

  it("rejects arbitrary events before creating a status artifact", () => {
    withTemporaryRoot((rootDir) => {
      expect(() =>
        writePleskSmsOtpReconciliationStatus({
          rootDir,
          eventName: "private-password raw-error arbitrary-stage"
        })
      ).toThrow("status event is not allowlisted");
      expect(fs.existsSync(path.join(rootDir, RECONCILIATION_STATUS_RELATIVE_PATH))).toBe(false);
    });
  });

  it("atomically replaces the prior safe stage without leaving a temporary file", () => {
    withTemporaryRoot((rootDir) => {
      writePleskSmsOtpReconciliationStatus({
        rootDir,
        eventName: "dispatch_started",
        now: () => new Date("2026-08-26T12:00:00.000Z")
      });
      const destination = writePleskSmsOtpReconciliationStatus({
        rootDir,
        eventName: "source_accepted",
        now: () => new Date("2026-08-26T12:00:01.000Z")
      });

      expect(JSON.parse(fs.readFileSync(destination, "utf8"))).toEqual({
        version: 1,
        component: "sms_otp_schema_reconciliation",
        stage: "source",
        status: "accepted",
        updatedAt: "2026-08-26T12:00:01.000Z"
      });
      expect(fs.readdirSync(path.dirname(destination))).toEqual([
        "sms-otp-schema-reconciliation-status.json"
      ]);
    });
  });

  it("writes only a closed-enum precondition reason component", () => {
    withTemporaryRoot((rootDir) => {
      const destination = writePleskSmsOtpReconciliationStatus({
        rootDir,
        eventName: "precondition_rejected",
        reasonComponent: "user_table",
        reasonDetail: "collation_incompatible",
        now: () => new Date("2026-08-26T12:00:02.000Z")
      });

      expect(JSON.parse(fs.readFileSync(destination, "utf8"))).toEqual({
        version: 1,
        component: "sms_otp_schema_reconciliation",
        stage: "precondition",
        status: "rejected",
        reasonComponent: "user_table",
        reasonDetail: "collation_incompatible",
        updatedAt: "2026-08-26T12:00:02.000Z"
      });
      expect(SAFE_RECONCILIATION_REASON_COMPONENTS).toEqual([
        "migration_state",
        "user_table",
        "user_columns",
        "user_indexes",
        "challenge_absence",
        "inspection"
      ]);
      expect(SAFE_RECONCILIATION_USER_TABLE_REASON_DETAILS).toEqual([
        "missing",
        "wrong_type",
        "metadata_unavailable",
        "collation_incompatible",
        "unsupported_collation"
      ]);
      expect(SAFE_RECONCILIATION_USER_COLUMNS_REASON_DETAILS).toContain("full_name_missing");
      expect(SAFE_RECONCILIATION_USER_COLUMNS_REASON_DETAILS).toContain("phone_verified_at_precision");
    });
  });

  it("writes only a closed-enum User column reason detail", () => {
    withTemporaryRoot((rootDir) => {
      const destination = writePleskSmsOtpReconciliationStatus({
        rootDir,
        eventName: "precondition_rejected",
        reasonComponent: "user_columns",
        reasonDetail: "normalized_phone_default",
        now: () => new Date("2026-08-26T12:00:03.000Z")
      });

      expect(JSON.parse(fs.readFileSync(destination, "utf8"))).toEqual({
        version: 1,
        component: "sms_otp_schema_reconciliation",
        stage: "precondition",
        status: "rejected",
        reasonComponent: "user_columns",
        reasonDetail: "normalized_phone_default",
        updatedAt: "2026-08-26T12:00:03.000Z"
      });
    });
  });

  it("rejects arbitrary or misplaced reason components without persisting them", () => {
    withTemporaryRoot((rootDir) => {
      expect(() =>
        writePleskSmsOtpReconciliationStatus({
          rootDir,
          eventName: "precondition_rejected",
          reasonComponent: "private-password raw-sql"
        })
      ).toThrow("reason component is not allowlisted");
      expect(fs.existsSync(path.join(rootDir, RECONCILIATION_STATUS_RELATIVE_PATH))).toBe(false);

      expect(() =>
        writePleskSmsOtpReconciliationStatus({
          rootDir,
          eventName: "complete_ready",
          reasonComponent: "user_table"
        })
      ).toThrow("reason component is not allowlisted");
      expect(fs.existsSync(path.join(rootDir, RECONCILIATION_STATUS_RELATIVE_PATH))).toBe(false);
    });
  });

  it("rejects arbitrary or misplaced User table reason details without persisting them", () => {
    withTemporaryRoot((rootDir) => {
      expect(() =>
        writePleskSmsOtpReconciliationStatus({
          rootDir,
          eventName: "precondition_rejected",
          reasonComponent: "user_table",
          reasonDetail: "private-collation raw-sql"
        })
      ).toThrow("reason detail is not allowlisted");
      expect(fs.existsSync(path.join(rootDir, RECONCILIATION_STATUS_RELATIVE_PATH))).toBe(false);

      expect(() =>
        writePleskSmsOtpReconciliationStatus({
          rootDir,
          eventName: "precondition_rejected",
          reasonComponent: "user_columns",
          reasonDetail: "missing"
        })
      ).toThrow("reason detail is not allowlisted");
      expect(fs.existsSync(path.join(rootDir, RECONCILIATION_STATUS_RELATIVE_PATH))).toBe(false);
    });
  });

  it("keeps every emitted field constrained to the static event allowlist", () => {
    for (const eventName of Object.keys(SAFE_RECONCILIATION_EVENTS)) {
      const event = getSafeReconciliationEvent(eventName);
      expect(Object.keys(event).every((key) => ["stage", "status", "action"].includes(key))).toBe(true);
      expect(
        Object.values(event as Record<string, string>).every((value) => /^[a-z_]+$/.test(value))
      ).toBe(true);
    }
  });
});
