/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";
const {
  SMS_OTP_MIGRATION_TARGET,
  assertPleskSmsOtpMigrationTarget
} = require("../../scripts/plesk-sms-otp-migration-guard.cjs");
const { MIGRATION_APPROVAL_ENV } = require("../../scripts/plesk-runtime-migration-runner.cjs");

describe("Plesk SMS OTP migration guard", () => {
  it("allows a normal startup when no migration target is present", () => {
    const error = vi.fn();

    expect(assertPleskSmsOtpMigrationTarget({ env: {}, error })).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it("allows only the fixed SMS OTP migration target", () => {
    const error = vi.fn();

    expect(assertPleskSmsOtpMigrationTarget({
      env: { [MIGRATION_APPROVAL_ENV]: SMS_OTP_MIGRATION_TARGET },
      error
    })).toBe(true);
    expect(error).not.toHaveBeenCalled();
  });

  it("fails closed for an empty or arbitrary target without logging its value", () => {
    for (const target of ["", "20260815000000_future_migration"]) {
      const error = vi.fn();

      expect(assertPleskSmsOtpMigrationTarget({
        env: { [MIGRATION_APPROVAL_ENV]: target },
        error
      })).toBe(false);
      if (target) {
        expect(error.mock.calls.flat().join(" ")).not.toContain(target);
      }
    }
  });
});
