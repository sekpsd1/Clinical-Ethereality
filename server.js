/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { assertNoPleskMigrationTarget } = require("./scripts/plesk-non-migration-preflight.cjs");
const { runPleskRuntimeMigration } = require("./scripts/plesk-runtime-migration-runner.cjs");

const standaloneServer = path.join(__dirname, ".next", "standalone", "server.js");

if (!fs.existsSync(standaloneServer)) {
  throw new Error("Production build is missing. Run npm run build:plesk-host before starting the app.");
}

if (!assertNoPleskMigrationTarget()) {
  throw new Error("Plesk non-migration preflight failed. Remove PLESK_MIGRATION_TARGET before starting this release.");
}

const migrationResult = runPleskRuntimeMigration({
  rootDir: __dirname
});

if (!migrationResult.shouldStart) {
  throw new Error("Approved Plesk migration did not complete. The standalone server was not started.");
}

require(standaloneServer);
