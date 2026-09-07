/* eslint-disable @typescript-eslint/no-require-imports */
const { readZoomTestMigrationStatus } = require("./zoom-test-plesk-migration-status.cjs");

function runZoomTestMigrationStatusProbe({
  rootDir = process.cwd(),
  readStatus = readZoomTestMigrationStatus,
  log = console.log,
  error = console.error
} = {}) {
  try {
    const status = readStatus({ rootDir });
    log(JSON.stringify({
      status: status.status,
      stage: status.stage,
      code: status.code,
      updatedAt: status.updatedAt
    }));
    return true;
  } catch {
    error(JSON.stringify({ status: "unavailable", stage: "unknown", code: "STATUS_UNAVAILABLE" }));
    return false;
  }
}

if (require.main === module && !runZoomTestMigrationStatusProbe()) {
  process.exitCode = 1;
}

module.exports = { runZoomTestMigrationStatusProbe };
