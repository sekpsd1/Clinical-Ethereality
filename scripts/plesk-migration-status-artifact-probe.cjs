/* eslint-disable @typescript-eslint/no-require-imports */
const {
  readPleskMigrationStatus
} = require("./plesk-migration-status.cjs");

function runPleskMigrationStatusArtifactProbe({
  rootDir = process.cwd(),
  readStatus = readPleskMigrationStatus,
  log = console.log,
  error = console.error
} = {}) {
  try {
    const status = readStatus({ rootDir });
    log(JSON.stringify(status));
    return true;
  } catch {
    error("[migration-status] status=unavailable");
    return false;
  }
}

if (require.main === module && !runPleskMigrationStatusArtifactProbe()) {
  process.exitCode = 1;
}

module.exports = {
  runPleskMigrationStatusArtifactProbe
};
