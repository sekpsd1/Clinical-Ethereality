/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
const {
  readZoomTestMigrationStatus,
  writeZoomTestMigrationStatus
} = require("../../scripts/zoom-test-plesk-migration-status.cjs");

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("Zoom Test migration status artifact", () => {
  it("round-trips only allowlisted operational fields", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "zoom-test-migration-"));
    temporaryRoots.push(rootDir);

    writeZoomTestMigrationStatus({
      rootDir,
      env: { NODE_ENV: "production" },
      status: "complete",
      stage: "complete",
      code: "READY",
      now: () => new Date("2026-09-07T00:00:00.000Z")
    });

    expect(readZoomTestMigrationStatus({ rootDir })).toEqual({
      version: 1,
      component: "zoom_test_migration",
      status: "complete",
      stage: "complete",
      code: "READY",
      updatedAt: "2026-09-07T00:00:00.000Z"
    });
  });

  it("rejects a non-allowlisted code", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "zoom-test-migration-"));
    temporaryRoots.push(rootDir);

    expect(() => writeZoomTestMigrationStatus({
      rootDir,
      env: { NODE_ENV: "production" },
      status: "failed",
      stage: "preflight",
      code: "DATABASE_NAME"
    })).toThrow("not allowlisted");
  });
});
