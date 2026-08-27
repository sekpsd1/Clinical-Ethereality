/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const {
  resolvePleskApplicationRoot,
  resolveRuntimePrivateDestination
} = require("./plesk-runtime-private-root.cjs");

const MIGRATION_STATUS_RELATIVE_PATH = path.join(
  "runtime-private",
  "migration-status.json"
);
const SAFE_MIGRATION_STATUSES = Object.freeze(["ready", "pending", "failed"]);
const SAFE_MIGRATION_NAME = /^\d{14}_[a-z0-9_]+$/;

function assertSafeMigrationStatus(status, migrationNames) {
  if (!SAFE_MIGRATION_STATUSES.includes(status)) {
    throw new Error("Migration status is not allowlisted.");
  }
  if (
    !Array.isArray(migrationNames) ||
    migrationNames.some((name) => typeof name !== "string" || !SAFE_MIGRATION_NAME.test(name))
  ) {
    throw new Error("Migration names are not allowlisted.");
  }

  const uniqueNames = [...new Set(migrationNames)].sort();
  if (uniqueNames.length !== migrationNames.length) {
    throw new Error("Migration names must be unique.");
  }
  if (status === "ready" && uniqueNames.length !== 0) {
    throw new Error("Ready migration status cannot include migration names.");
  }
  if (status === "pending" && uniqueNames.length === 0) {
    throw new Error("Pending migration status must include migration names.");
  }

  return uniqueNames;
}

function createMigrationStatusPayload({ status, migrationNames, now = () => new Date() }) {
  const safeNames = assertSafeMigrationStatus(status, migrationNames);
  const updatedAt = now();
  if (!(updatedAt instanceof Date) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("Migration status time is invalid.");
  }

  return {
    version: 1,
    component: "migration_status",
    status,
    migrationNames: safeNames,
    updatedAt: updatedAt.toISOString()
  };
}

function writePleskMigrationStatus({
  rootDir,
  env = process.env,
  nodeEnv = env?.NODE_ENV,
  fallbackRootDir = process.cwd(),
  status,
  migrationNames,
  now
}) {
  const applicationRoot = resolvePleskApplicationRoot({
    rootDir,
    env,
    nodeEnv,
    fallbackRootDir
  });
  const payload = createMigrationStatusPayload({ status, migrationNames, now });
  const { directory, destination } = resolveRuntimePrivateDestination({
    applicationRoot,
    relativePath: MIGRATION_STATUS_RELATIVE_PATH
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
      // Best-effort cleanup only; the application probe still fails closed.
    }
    throw error;
  }

  return destination;
}

function readPleskMigrationStatus({ rootDir = process.cwd() } = {}) {
  if (typeof rootDir !== "string" || !path.isAbsolute(rootDir)) {
    throw new Error("Migration status root must be absolute.");
  }
  const { destination } = resolveRuntimePrivateDestination({
    applicationRoot: rootDir,
    relativePath: MIGRATION_STATUS_RELATIVE_PATH
  });
  const parsed = JSON.parse(fs.readFileSync(destination, "utf8"));
  const expectedKeys = ["component", "migrationNames", "status", "updatedAt", "version"];
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join(",") !== expectedKeys.join(",") ||
    parsed.version !== 1 ||
    parsed.component !== "migration_status" ||
    typeof parsed.updatedAt !== "string" ||
    Number.isNaN(Date.parse(parsed.updatedAt))
  ) {
    throw new Error("Migration status artifact is invalid.");
  }

  const migrationNames = assertSafeMigrationStatus(parsed.status, parsed.migrationNames);
  return { ...parsed, migrationNames };
}

module.exports = {
  MIGRATION_STATUS_RELATIVE_PATH,
  SAFE_MIGRATION_NAME,
  SAFE_MIGRATION_STATUSES,
  createMigrationStatusPayload,
  readPleskMigrationStatus,
  writePleskMigrationStatus
};
