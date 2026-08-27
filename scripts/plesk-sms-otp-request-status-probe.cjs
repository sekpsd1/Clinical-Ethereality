/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const {
  SMS_OTP_REQUEST_STATUS_RELATIVE_PATH,
  writePleskSmsOtpRequestStatus
} = require("./plesk-sms-otp-request-status.cjs");

function runPleskSmsOtpRequestStatusProbe({
  rootDir = process.cwd(),
  writeStatus = writePleskSmsOtpRequestStatus,
  log = console.log,
  error = console.error
} = {}) {
  try {
    const destination = writeStatus({
      rootDir,
      eventName: "diagnostics_probe_ready"
    });
    const relativeDestination = path.relative(rootDir, destination);

    if (relativeDestination !== SMS_OTP_REQUEST_STATUS_RELATIVE_PATH) {
      throw new Error("SMS OTP request status probe destination is invalid.");
    }

    log("[sms-otp-request] stage=diagnostics_probe status=ready");
    return true;
  } catch {
    error("[sms-otp-request] stage=diagnostics_probe status=unavailable");
    return false;
  }
}

if (require.main === module && !runPleskSmsOtpRequestStatusProbe()) {
  process.exitCode = 1;
}

module.exports = {
  runPleskSmsOtpRequestStatusProbe
};
