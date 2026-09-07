/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
const { readStatus, writeStatus } = require("../../scripts/zoom-test-plesk-fixture-status.cjs");

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("Zoom Test fixture status artifact", () => {
  it("round-trips allowlisted fields only", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "zoom-test-fixture-"));
    roots.push(rootDir);
    writeStatus({ rootDir, status: "complete", stage: "complete", code: "READY",
      now: () => new Date("2026-09-07T00:00:00.000Z") });
    expect(readStatus({ rootDir })).toEqual({
      version: 1, component: "zoom_test_fixture", status: "complete", stage: "complete",
      code: "READY", updatedAt: "2026-09-07T00:00:00.000Z"
    });
  });
});
