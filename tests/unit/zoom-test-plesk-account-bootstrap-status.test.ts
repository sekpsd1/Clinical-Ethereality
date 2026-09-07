/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
const {
  readStatus,
  writeStatus
} = require("../../scripts/zoom-test-plesk-account-bootstrap-status.cjs");

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Zoom Test account bootstrap status artifact", () => {
  it("round-trips only allowlisted operational fields", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "zoom-test-account-bootstrap-"));
    roots.push(rootDir);
    writeStatus({
      rootDir,
      env: { NODE_ENV: "production" },
      status: "complete",
      stage: "complete",
      code: "READY",
      now: () => new Date("2026-09-07T00:00:00.000Z")
    });

    expect(readStatus({ rootDir })).toEqual({
      version: 1,
      component: "zoom_test_account_bootstrap",
      status: "complete",
      stage: "complete",
      code: "READY",
      updatedAt: "2026-09-07T00:00:00.000Z"
    });
  });
});
