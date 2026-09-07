/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const {
  assertDatabaseIdentity,
  assertSchemaReadiness,
  getSafeFailure,
  parseRunnerOptions,
  runTestFixtureRunner
} = require("./zoom-test-fixture-runner.cjs");
const { writeStatus } = require("./zoom-test-plesk-fixture-status.cjs");

const ACTION_ENV = "ZOOM_TEST_PLESK_FIXTURE_ACTION";
const ACTION = "precheck-create-verify-v1";
const FIXTURE_KEY_ENV = "ZOOM_TEST_PLESK_FIXTURE_KEY";
const SCHEDULED_AT_ENV = "ZOOM_TEST_PLESK_FIXTURE_SCHEDULED_AT";

function hasAction(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, ACTION_ENV);
}

function safeWrite(write, input) {
  try { write(input); return true; } catch { return false; }
}

async function runPleskFixture({
  rootDir,
  env = process.env,
  createPrisma = () => new PrismaClient(),
  parseOptions = parseRunnerOptions,
  assertIdentity = assertDatabaseIdentity,
  assertSchema = assertSchemaReadiness,
  runFixture = runTestFixtureRunner,
  write = writeStatus,
  log = console.log,
  error = console.error
}) {
  if (!hasAction(env)) return { requested: false, shouldStart: true, outcome: "not_requested" };
  const statusInput = (status, stage, code) => ({ rootDir, status, stage, code });
  const fail = (stage, code) => {
    safeWrite(write, statusInput("failed", stage, code));
    error(`[zoom-test-fixture] stage=${stage} status=failed code=${code}`);
    return { requested: true, shouldStart: false, outcome: "failed", stage, code };
  };
  if (env[ACTION_ENV] !== ACTION) return fail("precheck", "ACTION_INVALID");

  const fixtureKey = env[FIXTURE_KEY_ENV];
  const scheduledAt = env[SCHEDULED_AT_ENV];
  let prisma;
  try {
    prisma = createPrisma();
    const common = ["--confirm-test", `--fixture-key=${fixtureKey}`, `--scheduled-at=${scheduledAt}`];
    safeWrite(write, statusInput("pending", "precheck", "READY"));
    const precheckOptions = parseOptions(["--mode=precheck", ...common], env);
    const databaseIdentityHash = await assertIdentity(prisma, precheckOptions.databaseIdentityHash);
    await assertSchema(prisma);
    const precheck = await runFixture(prisma, precheckOptions, databaseIdentityHash);
    if (precheck?.status !== "ok" || typeof precheck.fingerprint !== "string") {
      return fail("precheck", "UNKNOWN_SAFE_FAILURE");
    }

    const target = `--target-fingerprint=${precheck.fingerprint}`;
    safeWrite(write, statusInput("pending", "create", "READY"));
    const createOptions = parseOptions(["--mode=create", ...common, target], env);
    const created = await runFixture(prisma, createOptions, databaseIdentityHash);
    if (created?.status !== "ok" || created?.fixtureStatus !== "scheduled" || created?.zoom !== "absent") {
      return fail("create", "UNKNOWN_SAFE_FAILURE");
    }

    safeWrite(write, statusInput("pending", "verify", "READY"));
    const verifyOptions = parseOptions([
      "--mode=verify", ...common, target, "--expected-status=scheduled", "--expected-zoom=absent"
    ], env);
    const verified = await runFixture(prisma, verifyOptions, databaseIdentityHash);
    if (verified?.status !== "ok" || verified?.fixtureStatus !== "scheduled" || verified?.zoom !== "absent") {
      return fail("verify", "UNKNOWN_SAFE_FAILURE");
    }

    if (!safeWrite(write, statusInput("complete", "complete", "READY"))) {
      return fail("complete", "UNKNOWN_SAFE_FAILURE");
    }
    log("[zoom-test-fixture] stage=complete status=complete code=READY");
    return { requested: true, shouldStart: false, outcome: "complete", stage: "complete", code: "READY" };
  } catch (caught) {
    const failure = getSafeFailure(caught);
    return fail(failure.stage, failure.code);
  } finally {
    if (prisma) {
      try { await prisma.$disconnect(); } catch { /* fail closed by stopped startup */ }
    }
  }
}

module.exports = { ACTION, ACTION_ENV, FIXTURE_KEY_ENV, SCHEDULED_AT_ENV, hasAction, runPleskFixture };
