/* eslint-disable @typescript-eslint/no-require-imports */
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const MIGRATION_APPROVAL_ENV = "PLESK_MIGRATION_TARGET";

function getCurrentMigrationTarget(rootDir) {
  const migrationsDir = path.join(rootDir, "prisma", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    return null;
  }

  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(migrationsDir, name, "migration.sql")))
    .sort();

  return migrations.at(-1) ?? null;
}

function runPleskRuntimeMigration({
  rootDir,
  env = process.env,
  spawnSync = childProcess.spawnSync,
  log = console.log,
  error = console.error
}) {
  const currentTarget = getCurrentMigrationTarget(rootDir);
  const approvedTarget = env[MIGRATION_APPROVAL_ENV];

  if (!approvedTarget || approvedTarget !== currentTarget) {
    if (approvedTarget) {
      log("[plesk-migration] Approval target does not match the current source migration; starting app without migrations.");
    }

    return {
      shouldStart: true,
      migrationRun: false
    };
  }

  const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");

  if (!fs.existsSync(prismaCli)) {
    error("[plesk-migration] Prisma CLI is unavailable; standalone server will not start.");
    return {
      shouldStart: false,
      migrationRun: false
    };
  }

  log("[plesk-migration] Approved migration target detected; running Prisma migration deploy.");

  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: rootDir,
    encoding: "utf8",
    env,
    shell: false,
    stdio: "ignore"
  });

  if (result.error || result.status !== 0) {
    error("[plesk-migration] Prisma migration deploy failed; standalone server will not start.");
    return {
      shouldStart: false,
      migrationRun: true
    };
  }

  log("[plesk-migration] Prisma migration deploy completed; starting standalone server.");

  return {
    shouldStart: true,
    migrationRun: true
  };
}

module.exports = {
  MIGRATION_APPROVAL_ENV,
  getCurrentMigrationTarget,
  runPleskRuntimeMigration
};
