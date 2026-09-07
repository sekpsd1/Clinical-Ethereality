/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const {
  resolvePleskApplicationRoot,
  resolveRuntimePrivateDestination
} = require("./plesk-runtime-private-root.cjs");

const ZOOM_TEST_MIGRATION_STATUS_RELATIVE_PATH = path.join(
  "runtime-private",
  "zoom-test-migration-status.json"
);
const SAFE_STATUSES = new Set(["pending", "complete", "failed"]);
const SAFE_STAGES = new Set(["preflight", "migration", "verification", "complete"]);
const SAFE_CODES = new Set([
  "ACTION_INVALID",
  "APP_URL_NOT_TEST",
  "CONFIRM_TEST_REQUIRED",
  "DATABASE_ACCESS_DENIED",
  "DATABASE_AUTHENTICATION_FAILED",
  "DATABASE_CONFIG_NOT_READY",
  "DATABASE_IDENTITY_MISMATCH",
  "DATABASE_PROVENANCE_REJECTED",
  "DATABASE_TLS_FAILED",
  "DATABASE_UNAVAILABLE",
  "DEPLOYMENT_MARKER_INVALID",
  "DEV_AUTH_BYPASS_NOT_DISABLED",
  "ENVIRONMENT_NOT_PRODUCTION",
  "INVALID_ARGUMENT",
  "MIGRATION_FAILED",
  "MIGRATION_STATUS_FAILED",
  "MIGRATION_TARGET_PRESENT",
  "PRISMA_CLI_UNAVAILABLE",
  "READY",
  "UNKNOWN_SAFE_FAILURE"
]);

function createZoomTestMigrationStatusPayload({ status, stage, code, now = () => new Date() }) {
  if (!SAFE_STATUSES.has(status) || !SAFE_STAGES.has(stage) || !SAFE_CODES.has(code)) {
    throw new Error("Zoom Test migration status is not allowlisted.");
  }
  const updatedAt = now();
  if (!(updatedAt instanceof Date) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("Zoom Test migration status time is invalid.");
  }
  return {
    version: 1,
    component: "zoom_test_migration",
    status,
    stage,
    code,
    updatedAt: updatedAt.toISOString()
  };
}

function writeZoomTestMigrationStatus({ rootDir, env = process.env, status, stage, code, now }) {
  const applicationRoot = resolvePleskApplicationRoot({ rootDir, env });
  const payload = createZoomTestMigrationStatusPayload({ status, stage, code, now });
  const { directory, destination } = resolveRuntimePrivateDestination({
    applicationRoot,
    relativePath: ZOOM_TEST_MIGRATION_STATUS_RELATIVE_PATH
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
      // Best-effort cleanup only; the deployment action remains fail-closed.
    }
    throw error;
  }
  return destination;
}

function readZoomTestMigrationStatus({ rootDir = process.cwd() } = {}) {
  const { destination } = resolveRuntimePrivateDestination({
    applicationRoot: rootDir,
    relativePath: ZOOM_TEST_MIGRATION_STATUS_RELATIVE_PATH
  });
  const parsed = JSON.parse(fs.readFileSync(destination, "utf8"));
  const expectedKeys = ["code", "component", "stage", "status", "updatedAt", "version"];
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join(",") !== expectedKeys.join(",") ||
    parsed.version !== 1 ||
    parsed.component !== "zoom_test_migration" ||
    !SAFE_STATUSES.has(parsed.status) ||
    !SAFE_STAGES.has(parsed.stage) ||
    !SAFE_CODES.has(parsed.code) ||
    typeof parsed.updatedAt !== "string" ||
    Number.isNaN(Date.parse(parsed.updatedAt))
  ) {
    throw new Error("Zoom Test migration status artifact is invalid.");
  }
  return parsed;
}

module.exports = {
  ZOOM_TEST_MIGRATION_STATUS_RELATIVE_PATH,
  createZoomTestMigrationStatusPayload,
  readZoomTestMigrationStatus,
  writeZoomTestMigrationStatus
};
