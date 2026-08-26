/* eslint-disable @typescript-eslint/no-require-imports */
const { assertPleskHostRuntimeReady } = require("./plesk-host-runtime-readiness.cjs");
const { assertPleskSmsOtpMigrationTarget } = require("./plesk-sms-otp-migration-guard.cjs");
const { runPleskRuntimeMigration } = require("./plesk-runtime-migration-runner.cjs");
const {
  runPleskSmsOtpSchemaReconciliation
} = require("./plesk-sms-otp-schema-reconciliation.cjs");

async function startPleskApplication({
  rootDir,
  startStandalone,
  assertMigrationTarget = assertPleskSmsOtpMigrationTarget,
  assertRuntimeReady = assertPleskHostRuntimeReady,
  runReconciliation = runPleskSmsOtpSchemaReconciliation,
  runMigration = runPleskRuntimeMigration
}) {
  if (!assertMigrationTarget()) {
    throw new Error("Plesk migration target is not approved for this release.");
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
