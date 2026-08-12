/* eslint-disable @typescript-eslint/no-require-imports */
const { assertPleskHostRuntimeReady } = require("./scripts/plesk-host-runtime-readiness.cjs");
const { assertNoPleskMigrationTarget } = require("./scripts/plesk-non-migration-preflight.cjs");
const { runPleskRuntimeMigration } = require("./scripts/plesk-runtime-migration-runner.cjs");

if (!assertNoPleskMigrationTarget()) {
  throw new Error("Plesk non-migration preflight failed. Remove PLESK_MIGRATION_TARGET before starting this release.");
}

assertPleskHostRuntimeReady({ rootDir: __dirname });

const migrationResult = runPleskRuntimeMigration({
  rootDir: __dirname
});

if (!migrationResult.shouldStart) {
  throw new Error("Approved Plesk migration did not complete. The standalone server was not started.");
}

require("./.next/standalone/server.js");
