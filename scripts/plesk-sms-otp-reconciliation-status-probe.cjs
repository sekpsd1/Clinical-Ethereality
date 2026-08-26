/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const {
  RECONCILIATION_STATUS_RELATIVE_PATH,
  writePleskSmsOtpReconciliationStatus
} = require("./plesk-sms-otp-reconciliation-status.cjs");

function runPleskSmsOtpReconciliationStatusProbe({
  rootDir = process.cwd(),
  writeStatus = writePleskSmsOtpReconciliationStatus,
  log = console.log,
  error = console.error
} = {}) {
  try {
    const destination = writeStatus({
      rootDir,
      eventName: "diagnostics_probe_ready"
    });
    const relativeDestination = path.relative(rootDir, destination);

    if (relativeDestination !== RECONCILIATION_STATUS_RELATIVE_PATH) {
      throw new Error("SMS OTP reconciliation status probe destination is invalid.");
    }

    log("[sms-otp-reconciliation] stage=diagnostics_probe status=ready");
    return true;
  } catch {
    error("[sms-otp-reconciliation] stage=diagnostics_probe status=unavailable");
    return false;
  }
}

if (require.main === module && !runPleskSmsOtpReconciliationStatusProbe()) {
  process.exitCode = 1;
}

module.exports = {
  runPleskSmsOtpReconciliationStatusProbe
};
