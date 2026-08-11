const MIGRATION_APPROVAL_ENV = "PLESK_MIGRATION_TARGET";

function hasPleskMigrationTarget(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, MIGRATION_APPROVAL_ENV);
}

function assertNoPleskMigrationTarget({
  env = process.env,
  error = console.error,
} = {}) {
  if (!hasPleskMigrationTarget(env)) {
    return true;
  }

  error(
    `[plesk-preflight] ${MIGRATION_APPROVAL_ENV} must be absent for this non-migration deployment.`,
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
  assertNoPleskMigrationTarget,
  hasPleskMigrationTarget,
};
