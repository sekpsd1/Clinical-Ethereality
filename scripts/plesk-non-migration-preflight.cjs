const MIGRATION_APPROVAL_ENV = "PLESK_MIGRATION_TARGET";
const {
  RECONCILIATION_APPROVAL_ENV
} = require("./plesk-sms-otp-schema-reconciliation.cjs");
const RUNTIME_MUTATION_TARGETS = [MIGRATION_APPROVAL_ENV, RECONCILIATION_APPROVAL_ENV];

function hasPleskMigrationTarget(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, MIGRATION_APPROVAL_ENV);
}

function hasPleskRuntimeMutationTarget(env = process.env) {
  return RUNTIME_MUTATION_TARGETS.some((key) => Object.prototype.hasOwnProperty.call(env, key));
}

function assertNoPleskMigrationTarget({
  env = process.env,
  error = console.error,
} = {}) {
  if (!hasPleskRuntimeMutationTarget(env)) {
    return true;
  }

  error(
    `[plesk-preflight] ${MIGRATION_APPROVAL_ENV} and ${RECONCILIATION_APPROVAL_ENV} must be absent for this non-migration deployment.`,
  );
  return false;
}

function main() {
  if (!assertNoPleskMigrationTarget()) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  MIGRATION_APPROVAL_ENV,
  RECONCILIATION_APPROVAL_ENV,
  RUNTIME_MUTATION_TARGETS,
  assertNoPleskMigrationTarget,
  hasPleskMigrationTarget,
  hasPleskRuntimeMutationTarget,
};
