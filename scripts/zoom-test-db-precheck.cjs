/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const {
  RUNNER_FAILURE_CODES,
  RunnerFailure,
  TEST_APP_URL,
  assertDatabaseIdentity
} = require("./zoom-test-fixture-runner.cjs");

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MIGRATION_TARGET_KEYS = [
  "PLESK_MIGRATION_TARGET",
  "PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET",
  "PLESK_SMS_OTP_RECONCILIATION_TARGET"
];
const PRECHECK_FAILURE_CODES = Object.freeze({
  ...RUNNER_FAILURE_CODES,
  DATABASE_ACCESS_DENIED: "DATABASE_ACCESS_DENIED",
  DATABASE_AUTHENTICATION_FAILED: "DATABASE_AUTHENTICATION_FAILED",
  DATABASE_CLIENT_VALIDATION_FAILED: "DATABASE_CLIENT_VALIDATION_FAILED",
  DATABASE_ENGINE_FAILED: "DATABASE_ENGINE_FAILED",
  DATABASE_ENGINE_PERMISSION_DENIED: "DATABASE_ENGINE_PERMISSION_DENIED",
  DATABASE_ENGINE_PLATFORM_MISMATCH: "DATABASE_ENGINE_PLATFORM_MISMATCH",
  DATABASE_ENGINE_UNAVAILABLE: "DATABASE_ENGINE_UNAVAILABLE",
  DATABASE_QUERY_FAILED: "DATABASE_QUERY_FAILED",
  DATABASE_TLS_FAILED: "DATABASE_TLS_FAILED",
  UNKNOWN_SAFE_FAILURE: "UNKNOWN_SAFE_FAILURE"
});
const SAFE_STAGES = new Set(["arguments", "database", "environment", "unknown"]);

function fail(code, stage) {
  throw new RunnerFailure(code, stage);
}

function parsePrecheckOptions(argv, environment = process.env) {
  if (argv.length !== 1 || argv[0] !== "--confirm-test") {
    fail(
      argv.includes("--confirm-test")
        ? PRECHECK_FAILURE_CODES.INVALID_ARGUMENT
        : PRECHECK_FAILURE_CODES.CONFIRM_TEST_REQUIRED,
      argv.includes("--confirm-test") ? "arguments" : "environment"
    );
  }
  if (environment.NODE_ENV !== "production") {
    fail(PRECHECK_FAILURE_CODES.ENVIRONMENT_NOT_PRODUCTION, "environment");
  }
  if (environment.CE_DEPLOYMENT_ENVIRONMENT !== "test") {
    fail(PRECHECK_FAILURE_CODES.DEPLOYMENT_MARKER_INVALID, "environment");
  }
  if (environment.NEXT_PUBLIC_APP_URL !== TEST_APP_URL) {
    fail(PRECHECK_FAILURE_CODES.APP_URL_NOT_TEST, "environment");
  }
  if (environment.ENABLE_DEV_AUTH_BYPASS !== "false") {
    fail(PRECHECK_FAILURE_CODES.DEV_AUTH_BYPASS_NOT_DISABLED, "environment");
  }
  if (typeof environment.DATABASE_URL !== "string" || environment.DATABASE_URL.trim() === "") {
    fail(PRECHECK_FAILURE_CODES.DATABASE_CONFIG_NOT_READY, "environment");
  }
  if (MIGRATION_TARGET_KEYS.some((key) => Object.prototype.hasOwnProperty.call(environment, key))) {
    fail(PRECHECK_FAILURE_CODES.MIGRATION_TARGET_PRESENT, "environment");
  }
  const databaseIdentityHash = environment.ZOOM_TEST_DATABASE_IDENTITY_SHA256?.trim().toLowerCase();
  if (!databaseIdentityHash || !HASH_PATTERN.test(databaseIdentityHash)) {
    fail(PRECHECK_FAILURE_CODES.DATABASE_IDENTITY_MISMATCH, "environment");
  }
  return { databaseIdentityHash };
}

function getSafeFailure(error) {
  if (
    error instanceof RunnerFailure &&
    Object.values(PRECHECK_FAILURE_CODES).includes(error.code)
  ) {
    return { code: error.code, stage: SAFE_STAGES.has(error.stage) ? error.stage : "unknown" };
  }
  const databaseCode = error?.code ?? error?.errorCode;
  if (databaseCode === "P1000") {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_AUTHENTICATION_FAILED, stage: "database" };
  }
  if (databaseCode === "P1010") {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_ACCESS_DENIED, stage: "database" };
  }
  if (databaseCode === "P1011") {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_TLS_FAILED, stage: "database" };
  }
  const databaseCodes = new Set(["P1001", "P1002", "P1003", "P1008", "P1017"]);
  if (databaseCodes.has(databaseCode)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_UNAVAILABLE, stage: "database" };
  }
  const errorName = typeof error?.name === "string" ? error.name : "";
  const errorMessage = typeof error?.message === "string" ? error.message : "";
  if (/authentication failed|invalid (?:database )?credentials?|access denied for user/i.test(errorMessage)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_AUTHENTICATION_FAILED, stage: "database" };
  }
  if (/not allowed to connect|denied access to (?:the )?database/i.test(errorMessage)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_ACCESS_DENIED, stage: "database" };
  }
  if (
    /can(?:not|'t) reach database server|connection (?:refused|timed out)|ECONNREFUSED|ETIMEDOUT|unknown database|database .* does not exist/i.test(
      errorMessage
    )
  ) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_UNAVAILABLE, stage: "database" };
  }
  if (/TLS connection|certificate verify failed|self[- ]signed certificate/i.test(errorMessage)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_TLS_FAILED, stage: "database" };
  }
  if (/permission denied|EACCES/i.test(errorMessage)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_ENGINE_PERMISSION_DENIED, stage: "database" };
  }
  if (/ELFCLASS|invalid ELF|wrong architecture|platform mismatch/i.test(errorMessage)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_ENGINE_PLATFORM_MISMATCH, stage: "database" };
  }
  if (/libssl|openssl|query engine library|query-engine.*not found/i.test(errorMessage)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_ENGINE_UNAVAILABLE, stage: "database" };
  }
  if (errorName === "PrismaClientInitializationError") {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_ENGINE_FAILED, stage: "database" };
  }
  if (["PrismaClientKnownRequestError", "PrismaClientUnknownRequestError"].includes(errorName)) {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_QUERY_FAILED, stage: "database" };
  }
  if (errorName === "PrismaClientRustPanicError") {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_ENGINE_FAILED, stage: "database" };
  }
  if (errorName === "PrismaClientValidationError") {
    return { code: PRECHECK_FAILURE_CODES.DATABASE_CLIENT_VALIDATION_FAILED, stage: "database" };
  }
  return { code: PRECHECK_FAILURE_CODES.UNKNOWN_SAFE_FAILURE, stage: "unknown" };
}

function writeSafeFailure(error, write = console.error) {
  const failure = getSafeFailure(error);
  write(JSON.stringify({
    status: "error",
    code: failure.code,
    mode: "precheck",
    stage: failure.stage
  }));
}

async function runDatabasePrecheck(prisma, options) {
  await assertDatabaseIdentity(prisma, options.databaseIdentityHash);
  return {
    status: "ok",
    mode: "precheck",
    stage: "complete",
    databaseIdentity: "matched"
  };
}

async function main() {
  const options = parsePrecheckOptions(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    console.log(JSON.stringify(await runDatabasePrecheck(prisma, options)));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    writeSafeFailure(error);
    process.exitCode = 1;
  });
}

module.exports = {
  MIGRATION_TARGET_KEYS,
  PRECHECK_FAILURE_CODES,
  getSafeFailure,
  parsePrecheckOptions,
  runDatabasePrecheck,
  writeSafeFailure
};
