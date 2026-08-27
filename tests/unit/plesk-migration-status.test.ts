/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
const {
  MIGRATION_STATUS_RELATIVE_PATH,
  readPleskMigrationStatus,
  writePleskMigrationStatus
} = require("../../scripts/plesk-migration-status.cjs");

const expectedMigration = "20260827113000_add_phone_otp_dispatch_claim";

function withTemporaryRoot(run: (rootDir: string) => void) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "plesk-migration-status-"));
  try {
    run(rootDir);
  } finally {
    fs.rmSync(rootDir, { force: true, recursive: true });
  }
}

describe("Plesk private migration status artifact", () => {
  it("writes only allowlisted fields atomically outside public", () => {
    withTemporaryRoot((rootDir) => {
      const destination = writePleskMigrationStatus({
        rootDir,
        status: "pending",
        migrationNames: [expectedMigration],
        now: () => new Date("2026-08-27T05:00:00.000Z")
      });
      const serialized = fs.readFileSync(destination, "utf8");

      expect(path.relative(rootDir, destination)).toBe(MIGRATION_STATUS_RELATIVE_PATH);
      expect(MIGRATION_STATUS_RELATIVE_PATH.startsWith("runtime-private")).toBe(true);
      expect(JSON.parse(serialized)).toEqual({
        version: 1,
        component: "migration_status",
        status: "pending",
        migrationNames: [expectedMigration],
        updatedAt: "2026-08-27T05:00:00.000Z"
      });
      expect(serialized).not.toMatch(/datasource|DATABASE_URL|password|host|SQL|record|secret|PII/i);
      expect(fs.readdirSync(path.dirname(destination))).toEqual(["migration-status.json"]);

      if (process.platform !== "win32") {
        expect(fs.statSync(path.dirname(destination)).mode & 0o777).toBe(0o700);
        expect(fs.statSync(destination).mode & 0o777).toBe(0o600);
      }
    });
  });

  it("atomically replaces pending with ready", () => {
    withTemporaryRoot((rootDir) => {
      writePleskMigrationStatus({ rootDir, status: "pending", migrationNames: [expectedMigration] });
      const destination = writePleskMigrationStatus({
        rootDir,
        status: "ready",
        migrationNames: []
      });

      expect(readPleskMigrationStatus({ rootDir })).toMatchObject({
        status: "ready",
        migrationNames: []
      });
      expect(fs.readdirSync(path.dirname(destination))).toEqual(["migration-status.json"]);
    });
  });

  it("rejects non-allowlisted statuses, names, fields, and destinations", () => {
    withTemporaryRoot((rootDir) => {
      expect(() =>
        writePleskMigrationStatus({
          rootDir,
          status: "unavailable",
          migrationNames: []
        })
      ).toThrow("not allowlisted");
      expect(() =>
        writePleskMigrationStatus({
          rootDir,
          status: "failed",
          migrationNames: ["../../private-data"]
        })
      ).toThrow("not allowlisted");
      expect(() =>
        writePleskMigrationStatus({
          rootDir,
          status: "pending",
          migrationNames: []
        })
      ).toThrow("must include migration names");

      const destination = path.join(rootDir, MIGRATION_STATUS_RELATIVE_PATH);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(
        destination,
        JSON.stringify({
          version: 1,
          component: "migration_status",
          status: "failed",
          migrationNames: [],
          updatedAt: new Date().toISOString(),
          rawError: "DATABASE_URL=private"
        })
      );
      expect(() => readPleskMigrationStatus({ rootDir })).toThrow("artifact is invalid");
    });
  });
});
