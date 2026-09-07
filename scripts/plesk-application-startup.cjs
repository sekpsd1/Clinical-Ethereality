/* eslint-disable @typescript-eslint/no-require-imports */
const { assertPleskHostRuntimeReady } = require("./plesk-host-runtime-readiness.cjs");
const { assertPleskSmsOtpMigrationTarget } = require("./plesk-sms-otp-migration-guard.cjs");
const { runPleskRuntimeMigration } = require("./plesk-runtime-migration-runner.cjs");
const {
  runPleskSmsOtpSchemaReconciliation
} = require("./plesk-sms-otp-schema-reconciliation.cjs");
const { runZoomTestPleskMigration } = require("./zoom-test-plesk-migration.cjs");

async function startPleskApplication({
  rootDir,
  startStandalone,
  assertMigrationTarget = assertPleskSmsOtpMigrationTarget,
  assertRuntimeReady = assertPleskHostRuntimeReady,
  runZoomTestMigration = runZoomTestPleskMigration,
  runReconciliation = runPleskSmsOtpSchemaReconciliation,
  runMigration = runPleskRuntimeMigration
}) {
  if (!assertMigrationTarget()) {
    throw new Error("Plesk migration target is not approved for this release.");
  }

  const zoomTestMigrationResult = await runZoomTestMigration({ rootDir });
  if (!zoomTestMigrationResult.shouldStart) {
    throw new Error("Zoom Test migration action completed or failed closed; standalone server was not started.");
  }

  assertRuntimeReady({ rootDir });

  const reconciliationResult = await runReconciliation({ rootDir });
  if (!reconciliationResult.shouldStart) {
    throw new Error("Plesk SMS OTP schema reconciliation did not authorize normal startup.");
  }

  const migrationResult = runMigration({ rootDir });
  if (!migrationResult.shouldStart) {
    throw new Error("Approved Plesk migration did not complete. The standalone server was not started.");
  }

  startStandalone();
}

module.exports = {
  startPleskApplication
};
