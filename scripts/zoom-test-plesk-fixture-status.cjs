/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { resolveRuntimePrivateDestination } = require("./plesk-runtime-private-root.cjs");
const { RUNNER_FAILURE_CODES } = require("./zoom-test-fixture-runner.cjs");

const STATUS_RELATIVE_PATH = path.join("runtime-private", "zoom-test-fixture-status.json");
const SAFE_STATUSES = new Set(["pending", "complete", "failed"]);
const SAFE_STAGES = new Set([
  "arguments", "database", "environment", "fixture", "integrity", "schema", "slot",
  "target", "transaction", "unknown", "precheck", "create", "verify", "complete"
]);
const SAFE_CODES = new Set(["ACTION_INVALID", "READY", ...Object.values(RUNNER_FAILURE_CODES)]);

function payload({ status, stage, code, now = () => new Date() }) {
  if (!SAFE_STATUSES.has(status) || !SAFE_STAGES.has(stage) || !SAFE_CODES.has(code)) {
    throw new Error("Zoom Test fixture status is not allowlisted.");
  }
  const updatedAt = now();
  if (!(updatedAt instanceof Date) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("Zoom Test fixture status time is invalid.");
  }
  return { version: 1, component: "zoom_test_fixture", status, stage, code, updatedAt: updatedAt.toISOString() };
}

function writeStatus({ rootDir, status, stage, code, now }) {
  const value = payload({ status, stage, code, now });
  const { directory, destination } = resolveRuntimePrivateDestination({
    applicationRoot: rootDir,
    relativePath: STATUS_RELATIVE_PATH
  });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.mkdirSync(directory, { mode: 0o700, recursive: true });
  fs.chmodSync(directory, 0o700);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "w", mode: 0o600 });
    fs.renameSync(temporary, destination);
    fs.chmodSync(destination, 0o600);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch { /* fail closed below */ }
    throw error;
  }
  return destination;
}

function readStatus({ rootDir = process.cwd() } = {}) {
  const { destination } = resolveRuntimePrivateDestination({ applicationRoot: rootDir, relativePath: STATUS_RELATIVE_PATH });
  const value = JSON.parse(fs.readFileSync(destination, "utf8"));
  const keys = ["code", "component", "stage", "status", "updatedAt", "version"];
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== keys.join(",") || value.version !== 1 ||
      value.component !== "zoom_test_fixture" || !SAFE_STATUSES.has(value.status) ||
      !SAFE_STAGES.has(value.stage) || !SAFE_CODES.has(value.code) ||
      typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) {
    throw new Error("Zoom Test fixture status artifact is invalid.");
  }
  return value;
}

module.exports = { STATUS_RELATIVE_PATH, payload, readStatus, writeStatus };
