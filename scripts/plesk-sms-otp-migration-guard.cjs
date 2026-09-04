/* eslint-disable @typescript-eslint/no-require-imports */
const {
  MIGRATION_APPROVAL_ENV,
  SMS_OTP_MIGRATION_TARGET,
  hasPleskMigrationTarget,
  isAllowedPleskMigrationTarget
} = require("./plesk-runtime-migration-runner.cjs");

function assertPleskSmsOtpMigrationTarget({
  env = process.env,
  error = console.error
} = {}) {
  if (!hasPleskMigrationTarget(env) || isAllowedPleskMigrationTarget(env[MIGRATION_APPROVAL_ENV])) {
    return true;
  }

  error(`[plesk-migration] ${MIGRATION_APPROVAL_ENV} is not an approved migration target.`);
  return false;
}

module.exports = {
  SMS_OTP_MIGRATION_TARGET,
  assertPleskSmsOtpMigrationTarget
};
