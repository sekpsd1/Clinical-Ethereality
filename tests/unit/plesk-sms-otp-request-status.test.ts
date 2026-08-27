/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import { describe, expect, it } from "vitest";
const {
  SAFE_SMS_OTP_DATABASE_ERROR_CATEGORIES,
  SAFE_SMS_OTP_PREFLIGHT_COMPONENTS,
  SAFE_SMS_OTP_ROUTE_COMPONENTS,
  SAFE_SMS_OTP_ROUTE_STATUSES,
  SMS_OTP_REQUEST_STATUS_RELATIVE_PATH,
  writePleskSmsOtpRequestStatus
} = require("../../scripts/plesk-sms-otp-request-status.cjs");

function withTemporaryRoot(run: (rootDir: string) => void) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "sms-otp-request-status-"));

  try {
    run(rootDir);
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
}

describe("Plesk SMS OTP request private status", () => {
  it("writes only the allowlisted preflight failure outside public root", () => {
    withTemporaryRoot((rootDir) => {
      const destination = writePleskSmsOtpRequestStatus({
        rootDir,
        eventName: "request_failed",
        diagnostic: {
          stage: "request_preflight",
          preflightComponent: "latest_challenge_lookup",
          databaseErrorCategory: "table_missing",
          applicationHttpStatus: 503,
          providerHttpStatus: null,
          providerErrorCode: null,
          providerErrorCategory: "not_applicable"
        },
        now: () => new Date("2026-08-27T01:02:03.000Z")
      });
      const serialized = fs.readFileSync(destination, "utf8");

      expect(path.relative(rootDir, destination)).toBe(SMS_OTP_REQUEST_STATUS_RELATIVE_PATH);
      expect(SMS_OTP_REQUEST_STATUS_RELATIVE_PATH.startsWith("runtime-private")).toBe(true);
      expect(JSON.parse(serialized)).toEqual({
        version: 1,
        component: "sms_otp_request",
        stage: "request_preflight",
        status: "failed",
        preflightComponent: "latest_challenge_lookup",
        databaseErrorCategory: "table_missing",
        applicationHttpStatus: 503,
        updatedAt: "2026-08-27T01:02:03.000Z"
      });
      expect(Object.keys(JSON.parse(serialized))).toEqual([
        "version",
        "component",
        "stage",
        "status",
        "preflightComponent",
        "databaseErrorCategory",
        "applicationHttpStatus",
        "updatedAt"
      ]);
      expect(serialized).not.toMatch(/phone|userId|fullName|dateOfBirth|raw|SQL|DATABASE_URL|secret|token|refno|header|body/i);

      const directory = path.dirname(destination);
      if (process.platform !== "win32") {
        expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
        expect(fs.statSync(destination).mode & 0o777).toBe(0o600);
      }
    });
  });

  it("atomically replaces the prior status without leaving a temporary file", () => {
    withTemporaryRoot((rootDir) => {
      writePleskSmsOtpRequestStatus({
        rootDir,
        eventName: "diagnostics_probe_ready",
        now: () => new Date("2026-08-27T01:00:00.000Z")
      });
      const destination = writePleskSmsOtpRequestStatus({
        rootDir,
        eventName: "request_failed",
        diagnostic: {
          stage: "request_provider",
          applicationHttpStatus: 503,
          providerHttpStatus: 503,
          providerErrorCode: null,
          providerErrorCategory: "provider_unavailable"
        },
        now: () => new Date("2026-08-27T01:00:01.000Z")
      });

      expect(JSON.parse(fs.readFileSync(destination, "utf8"))).toEqual({
        version: 1,
        component: "sms_otp_request",
        stage: "request_provider",
        status: "failed",
        applicationHttpStatus: 503,
        providerHttpStatus: 503,
        providerErrorCategory: "provider_unavailable",
        updatedAt: "2026-08-27T01:00:01.000Z"
      });
      expect(fs.readdirSync(path.dirname(destination))).toEqual(["sms-otp-request-status.json"]);
    });
  });

  it("writes only closed-enum route progress and failure metadata", () => {
    withTemporaryRoot((rootDir) => {
      const destination = writePleskSmsOtpRequestStatus({
        rootDir,
        eventName: "request_route_status",
        routeStatus: {
          routeComponent: "session_lookup",
          status: "started"
        },
        now: () => new Date("2026-08-27T01:03:00.000Z")
      });

      expect(JSON.parse(fs.readFileSync(destination, "utf8"))).toEqual({
        version: 1,
        component: "sms_otp_request",
        stage: "request_route",
        status: "started",
        routeComponent: "session_lookup",
        updatedAt: "2026-08-27T01:03:00.000Z"
      });

      writePleskSmsOtpRequestStatus({
        rootDir,
        eventName: "request_route_status",
        routeStatus: {
          routeComponent: "service_dispatch",
          status: "failed",
          applicationHttpStatus: 503
        },
        now: () => new Date("2026-08-27T01:03:01.000Z")
      });
      const serialized = fs.readFileSync(destination, "utf8");

      expect(JSON.parse(serialized)).toEqual({
        version: 1,
        component: "sms_otp_request",
        stage: "request_route",
        status: "failed",
        routeComponent: "service_dispatch",
        applicationHttpStatus: 503,
        updatedAt: "2026-08-27T01:03:01.000Z"
      });
      expect(serialized).not.toMatch(/userId|fullName|dateOfBirth|phone|cookie|raw|SQL|secret|token|refno|header|body/i);
    });
  });

  it("rejects unexpected fields and values before creating an artifact", () => {
    withTemporaryRoot((rootDir) => {
      expect(() =>
        writePleskSmsOtpRequestStatus({
          rootDir,
          eventName: "request_failed",
          diagnostic: {
            stage: "request_preflight",
            preflightComponent: "user_lookup",
            databaseErrorCategory: "unknown",
            applicationHttpStatus: 503,
            providerHttpStatus: null,
            providerErrorCode: null,
            providerErrorCategory: "not_applicable",
            rawError: "password=must-not-write"
          }
        })
      ).toThrow("field is not allowlisted");
      expect(fs.existsSync(path.join(rootDir, SMS_OTP_REQUEST_STATUS_RELATIVE_PATH))).toBe(false);
    });
  });

  it("keeps preflight components and database categories closed", () => {
    expect(SAFE_SMS_OTP_PREFLIGHT_COMPONENTS).toEqual([
      "user_lookup",
      "phone_owner_lookup",
      "latest_challenge_lookup",
      "request_count_lookup",
      "dispatch_claim"
    ]);
    expect(SAFE_SMS_OTP_DATABASE_ERROR_CATEGORIES).toEqual([
      "table_missing",
      "column_missing",
      "connection_unavailable",
      "timeout",
      "query_rejected",
      "unknown"
    ]);
    expect(SAFE_SMS_OTP_ROUTE_COMPONENTS).toEqual([
      "session_lookup",
      "role_check",
      "request_body",
      "request_schema",
      "service_dispatch"
    ]);
    expect(SAFE_SMS_OTP_ROUTE_STATUSES).toEqual(["started", "ready", "failed"]);
  });

  it("rejects non-allowlisted route fields and statuses", () => {
    withTemporaryRoot((rootDir) => {
      expect(() =>
        writePleskSmsOtpRequestStatus({
          rootDir,
          eventName: "request_route_status",
          routeStatus: {
            routeComponent: "session_lookup",
            status: "failed",
            applicationHttpStatus: 503,
            rawError: "private-session-error"
          }
        })
      ).toThrow("field is not allowlisted");
      expect(() =>
        writePleskSmsOtpRequestStatus({
          rootDir,
          eventName: "request_route_status",
          routeStatus: {
            routeComponent: "unexpected_component",
            status: "failed",
            applicationHttpStatus: 503
          }
        })
      ).toThrow("component is not allowlisted");
      expect(fs.existsSync(path.join(rootDir, SMS_OTP_REQUEST_STATUS_RELATIVE_PATH))).toBe(false);
    });
  });
});
