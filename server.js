/* eslint-disable @typescript-eslint/no-require-imports */
const { assertPleskHostRuntimeReady } = require("./scripts/plesk-host-runtime-readiness.cjs");
const { assertPleskSmsOtpMigrationTarget } = require("./scripts/plesk-sms-otp-migration-guard.cjs");
const { runPleskRuntimeMigration } = require("./scripts/plesk-runtime-migration-runner.cjs");

if (!assertPleskSmsOtpMigrationTarget()) {
  throw new Error("Plesk migration target is not approved for this release.");
}

assertPleskHostRuntimeReady({ rootDir: __dirname });

const migrationResult = runPleskRuntimeMigration({
  rootDir: __dirname
});

if (!migrationResult.shouldStart) {
  throw new Error("Approved Plesk migration did not complete. The standalone server was not started.");
}

require("./.next/standalone/server.js");
