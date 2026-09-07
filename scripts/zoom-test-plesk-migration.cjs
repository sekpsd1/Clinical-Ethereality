/* eslint-disable @typescript-eslint/no-require-imports */
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");
const {
  getSafeFailure,
  parsePrecheckOptions,
  runDatabasePrecheck
} = require("./zoom-test-db-precheck.cjs");
const { writeZoomTestMigrationStatus } = require("./zoom-test-plesk-migration-status.cjs");

const ZOOM_TEST_MIGRATION_ACTION_ENV = "ZOOM_TEST_PLESK_MIGRATION_ACTION";
const ZOOM_TEST_MIGRATION_ACTION = "preflight-and-deploy-v1";

function hasZoomTestMigrationAction(env = process.env) {
  return Object.prototype.hasOwnProperty.call(env, ZOOM_TEST_MIGRATION_ACTION_ENV);
}

function safeWriteStatus(writeStatus, input) {
  try {
    writeStatus(input);
    return true;
  } catch {
    return false;
  }
}

async function runZoomTestPleskMigration({
  rootDir,
  env = process.env,
  createPrisma = () => new PrismaClient(),
  parseOptions = parsePrecheckOptions,
  precheck = runDatabasePrecheck,
  spawnSync = childProcess.spawnSync,
  existsSync = fs.existsSync,
  writeStatus = writeZoomTestMigrationStatus,
  log = console.log,
  error = console.error
}) {
  if (!hasZoomTestMigrationAction(env)) {
    return { requested: false, shouldStart: true, outcome: "not_requested" };
  }

  const statusInput = (status, stage, code) => ({ rootDir, env, status, stage, code });
  const fail = (stage, code) => {
    safeWriteStatus(writeStatus, statusInput("failed", stage, code));
    error(`[zoom-test-migration] stage=${stage} status=failed code=${code}`);
    return { requested: true, shouldStart: false, outcome: "failed", stage, code };
  };

  if (env[ZOOM_TEST_MIGRATION_ACTION_ENV] !== ZOOM_TEST_MIGRATION_ACTION) {
    return fail("preflight", "ACTION_INVALID");
  }

  let prisma;
  try {
    safeWriteStatus(writeStatus, statusInput("pending", "preflight", "READY"));
    const options = parseOptions(["--confirm-test"], env);
    prisma = createPrisma();
    await precheck(prisma, options);
  } catch (caught) {
    const failure = getSafeFailure(caught);
    return fail("preflight", failure.code);
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch {
        // The preflight result already fails closed if database access was incomplete.
      }
    }
  }

  const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
  if (!existsSync(prismaCli)) {
    return fail("migration", "PRISMA_CLI_UNAVAILABLE");
  }

  safeWriteStatus(writeStatus, statusInput("pending", "migration", "READY"));
  const deploy = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: rootDir,
    env,
    encoding: "utf8",
    shell: false,
    stdio: "ignore"
  });
  if (deploy.error || deploy.status !== 0) {
    return fail("migration", "MIGRATION_FAILED");
  }

  safeWriteStatus(writeStatus, statusInput("pending", "verification", "READY"));
  const status = spawnSync(process.execPath, [prismaCli, "migrate", "status"], {
    cwd: rootDir,
    env,
    encoding: "utf8",
    shell: false,
    stdio: "ignore"
  });
  if (status.error || status.status !== 0) {
    return fail("verification", "MIGRATION_STATUS_FAILED");
  }

  if (!safeWriteStatus(writeStatus, statusInput("complete", "complete", "READY"))) {
    return fail("complete", "UNKNOWN_SAFE_FAILURE");
  }
  log("[zoom-test-migration] stage=complete status=complete code=READY");
  return { requested: true, shouldStart: false, outcome: "complete", stage: "complete", code: "READY" };
}

module.exports = {
  ZOOM_TEST_MIGRATION_ACTION,
  ZOOM_TEST_MIGRATION_ACTION_ENV,
  hasZoomTestMigrationAction,
  runZoomTestPleskMigration
};
