/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const {
  getSafeFailure,
  parseBootstrapOptions,
  runBootstrap
} = require("./zoom-test-account-bootstrap.cjs");
const {
  assertDatabaseIdentity,
  assertSchemaReadiness
} = require("./zoom-test-fixture-runner.cjs");
const { writeStatus } = require("./zoom-test-plesk-account-bootstrap-status.cjs");

const ACTION_ENV = "ZOOM_TEST_PLESK_ACCOUNT_BOOTSTRAP_ACTION";
const ACTION = "precheck-apply-verify-v1";

function hasAction(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, ACTION_ENV);
}

function safeWriteStatus(write, input) {
  try {
    write(input);
    return true;
  } catch {
    return false;
  }
}

async function runPleskAccountBootstrap({
  rootDir,
  env = process.env,
  createPrisma = () => new PrismaClient(),
  parseOptions = parseBootstrapOptions,
  assertIdentity = assertDatabaseIdentity,
  assertSchema = assertSchemaReadiness,
  bootstrap = runBootstrap,
  write = writeStatus,
  log = console.log,
  error = console.error
}) {
  if (!hasAction(env)) {
    return { requested: false, shouldStart: true, outcome: "not_requested" };
  }

  const statusInput = (status, stage, code) => ({ rootDir, env, status, stage, code });
  const fail = (stage, code) => {
    safeWriteStatus(write, statusInput("failed", stage, code));
    error(`[zoom-test-account-bootstrap] stage=${stage} status=failed code=${code}`);
    return { requested: true, shouldStart: false, outcome: "failed", stage, code };
  };

  if (env[ACTION_ENV] !== ACTION) {
    return fail("precheck", "ACTION_INVALID");
  }

  let prisma;
  try {
    prisma = createPrisma();
    safeWriteStatus(write, statusInput("pending", "precheck", "READY"));
    const precheckOptions = parseOptions(["--mode=precheck", "--confirm-test"], env);
    const databaseIdentityHash = await assertIdentity(prisma, precheckOptions.databaseIdentityHash);
    await assertSchema(prisma);
    const precheck = await bootstrap(prisma, precheckOptions, databaseIdentityHash);
    if (precheck?.status !== "ok" || typeof precheck.fingerprint !== "string") {
      return fail("precheck", "UNKNOWN_SAFE_FAILURE");
    }

    safeWriteStatus(write, statusInput("pending", "apply", "READY"));
    const targetArgument = `--target-fingerprint=${precheck.fingerprint}`;
    const applyOptions = parseOptions(
      ["--mode=apply", "--confirm-test", targetArgument],
      env
    );
    const applied = await bootstrap(prisma, applyOptions, databaseIdentityHash);
    if (applied?.status !== "ok") {
      return fail("apply", "UNKNOWN_SAFE_FAILURE");
    }

    safeWriteStatus(write, statusInput("pending", "verify", "READY"));
    const verifyOptions = parseOptions(
      ["--mode=verify", "--confirm-test", targetArgument],
      env
    );
    const verified = await bootstrap(prisma, verifyOptions, databaseIdentityHash);
    if (verified?.status !== "ok" || verified?.replayed !== true) {
      return fail("verify", "UNKNOWN_SAFE_FAILURE");
    }

    if (!safeWriteStatus(write, statusInput("complete", "complete", "READY"))) {
      return fail("complete", "UNKNOWN_SAFE_FAILURE");
    }
    log("[zoom-test-account-bootstrap] stage=complete status=complete code=READY");
    return { requested: true, shouldStart: false, outcome: "complete", stage: "complete", code: "READY" };
  } catch (caught) {
    const failure = getSafeFailure(caught);
    return fail(failure.stage, failure.code);
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {
        // The action remains fail-closed when cleanup is incomplete.
      }
    }
  }
}

module.exports = {
  ACTION,
  ACTION_ENV,
  hasAction,
  runPleskAccountBootstrap
};
