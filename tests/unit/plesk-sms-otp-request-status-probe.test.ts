/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
import { describe, expect, it, vi } from "vitest";
const {
  SMS_OTP_REQUEST_STATUS_RELATIVE_PATH
} = require("../../scripts/plesk-sms-otp-request-status.cjs");
const {
  runPleskSmsOtpRequestStatusProbe
} = require("../../scripts/plesk-sms-otp-request-status-probe.cjs");

describe("Plesk SMS OTP request status probe", () => {
  it("proves the private status path without reading environment or database state", () => {
    const rootDir = path.resolve("application-root");
    const log = vi.fn();
    const error = vi.fn();
    const writeStatus = vi
      .fn()
      .mockReturnValue(path.join(rootDir, SMS_OTP_REQUEST_STATUS_RELATIVE_PATH));

    expect(runPleskSmsOtpRequestStatusProbe({ rootDir, writeStatus, log, error })).toBe(true);
    expect(writeStatus).toHaveBeenCalledWith({
      rootDir,
      eventName: "diagnostics_probe_ready"
    });
    expect(log).toHaveBeenCalledWith(
      "[sms-otp-request] stage=diagnostics_probe status=ready"
    );
    expect(error).not.toHaveBeenCalled();
  });

  it("fails safely without exposing the writer error", () => {
    const log = vi.fn();
    const error = vi.fn();
    const writeStatus = vi.fn(() => {
      throw new Error("DATABASE_URL private-password raw-database-error");
    });

    expect(
      runPleskSmsOtpRequestStatusProbe({
        rootDir: path.resolve("application-root"),
        writeStatus,
        log,
        error
      })
    ).toBe(false);
    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "[sms-otp-request] stage=diagnostics_probe status=unavailable"
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(error.mock.calls)).not.toContain("private-password");
    expect(JSON.stringify(error.mock.calls)).not.toContain("raw-database-error");
  });

  it("rejects a writer destination outside the private allowlisted path", () => {
    const error = vi.fn();

    expect(
      runPleskSmsOtpRequestStatusProbe({
        rootDir: path.resolve("application-root"),
        writeStatus: vi.fn().mockReturnValue(path.resolve("unexpected-status.json")),
        log: vi.fn(),
        error
      })
    ).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "[sms-otp-request] stage=diagnostics_probe status=unavailable"
    );
  });
});
