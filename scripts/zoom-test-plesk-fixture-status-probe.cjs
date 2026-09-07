/* eslint-disable @typescript-eslint/no-require-imports */
const { readStatus } = require("./zoom-test-plesk-fixture-status.cjs");

function runStatusProbe({ rootDir = process.cwd(), read = readStatus, log = console.log, error = console.error } = {}) {
  try {
    const value = read({ rootDir });
    log(JSON.stringify({ status: value.status, stage: value.stage, code: value.code, updatedAt: value.updatedAt }));
    return true;
  } catch {
    error(JSON.stringify({ status: "unavailable", stage: "unknown", code: "STATUS_UNAVAILABLE" }));
    return false;
  }
}

if (require.main === module && !runStatusProbe()) process.exitCode = 1;
module.exports = { runStatusProbe };
