/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const {
  resolvePleskApplicationRoot,
  resolveRuntimePrivateDestination
} = require("./plesk-runtime-private-root.cjs");
const { FAILURE_CODES } = require("./zoom-test-account-bootstrap.cjs");

const STATUS_RELATIVE_PATH = path.join("runtime-private", "zoom-test-account-bootstrap-status.json");
const SAFE_STATUSES = new Set(["pending", "complete", "failed"]);
const SAFE_STAGES = new Set([
  "arguments",
  "database",
  "environment",
  "integrity",
  "schema",
  "target",
  "transaction",
  "unknown",
  "precheck",
  "apply",
  "verify",
  "complete"
]);
const SAFE_CODES = new Set(["ACTION_INVALID", "READY", ...Object.values(FAILURE_CODES)]);

function createStatusPayload({ status, stage, code, now = () => new Date() }) {
  if (!SAFE_STATUSES.has(status) || !SAFE_STAGES.has(stage) || !SAFE_CODES.has(code)) {
    throw new Error("Zoom Test account bootstrap status is not allowlisted.");
  }
  const updatedAt = now();
  if (!(updatedAt instanceof Date) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("Zoom Test account bootstrap status time is invalid.");
  }
  return {
    version: 1,
    component: "zoom_test_account_bootstrap",
    status,
    stage,
    code,
    updatedAt: updatedAt.toISOString()
  };
}

function writeStatus({ rootDir, env = process.env, status, stage, code, now }) {
  const applicationRoot = resolvePleskApplicationRoot({ rootDir, env });
  const payload = createStatusPayload({ status, stage, code, now });
  const { directory, destination } = resolveRuntimePrivateDestination({
    applicationRoot,
    relativePath: STATUS_RELATIVE_PATH
  });
  const temporary = `${destination}.${process.pid}.tmp`;

  fs.mkdirSync(directory, { mode: 0o700, recursive: true });
  fs.chmodSync(directory, 0o700);
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(payload)}\n`, {
      encoding: "utf8",
      flag: "w",
      mode: 0o600
    });
    fs.renameSync(temporary, destination);
    fs.chmodSync(destination, 0o600);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // Best-effort cleanup only; the action remains fail-closed.
    }
    throw error;
  }
  return destination;
}

function readStatus({ rootDir = process.cwd() } = {}) {
  const { destination } = resolveRuntimePrivateDestination({
    applicationRoot: rootDir,
    relativePath: STATUS_RELATIVE_PATH
  });
  const parsed = JSON.parse(fs.readFileSync(destination, "utf8"));
  const expectedKeys = ["code", "component", "stage", "status", "updatedAt", "version"];
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join(",") !== expectedKeys.join(",") ||
    parsed.version !== 1 ||
    parsed.component !== "zoom_test_account_bootstrap" ||
    !SAFE_STATUSES.has(parsed.status) ||
    !SAFE_STAGES.has(parsed.stage) ||
    !SAFE_CODES.has(parsed.code) ||
    typeof parsed.updatedAt !== "string" ||
    Number.isNaN(Date.parse(parsed.updatedAt))
  ) {
    throw new Error("Zoom Test account bootstrap status artifact is invalid.");
  }
  return parsed;
}

module.exports = {
  STATUS_RELATIVE_PATH,
  createStatusPayload,
  readStatus,
  writeStatus
};
