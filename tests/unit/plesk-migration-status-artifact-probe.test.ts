/* eslint-disable @typescript-eslint/no-require-imports */
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
const {
  runPleskMigrationStatusArtifactProbe
} = require("../../scripts/plesk-migration-status-artifact-probe.cjs");

describe("Plesk migration status artifact reader", () => {
  it("prints only the validated private artifact", () => {
    const log = vi.fn();
    const error = vi.fn();
    const artifact = {
      version: 1,
      component: "migration_status",
      status: "pending",
      migrationNames: ["20260827113000_add_phone_otp_dispatch_claim"],
      updatedAt: "2026-08-27T05:00:00.000Z"
    };

    expect(
      runPleskMigrationStatusArtifactProbe({
        rootDir: path.resolve("application-root"),
        readStatus: vi.fn().mockReturnValue(artifact),
        log,
        error
      })
    ).toBe(true);
    expect(log).toHaveBeenCalledWith(JSON.stringify(artifact));
    expect(error).not.toHaveBeenCalled();
  });

  it("fails without exposing private reader errors", () => {
    const log = vi.fn();
    const error = vi.fn();
    const readStatus = vi.fn(() => {
      throw new Error("DATABASE_URL mysql://private raw-record");
    });

    expect(
      runPleskMigrationStatusArtifactProbe({
        rootDir: path.resolve("application-root"),
        readStatus,
        log,
        error
      })
    ).toBe(false);
    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[migration-status] status=unavailable");
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/DATABASE_URL|private|raw-record/);
  });
});
