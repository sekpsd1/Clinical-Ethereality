/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const {
  resolvePleskApplicationRoot,
  resolveRuntimePrivateDestination
} = require("./plesk-runtime-private-root.cjs");

const SMS_OTP_REQUEST_STATUS_RELATIVE_PATH = path.join(
  "runtime-private",
  "sms-otp-request-status.json"
);

const SAFE_SMS_OTP_REQUEST_STAGES = Object.freeze([
  "request_schema",
  "request_preflight",
  "request_provider",
  "request_persistence",
  "verify_provider"
]);
const SAFE_SMS_OTP_PREFLIGHT_COMPONENTS = Object.freeze([
  "user_lookup",
  "phone_owner_lookup",
  "latest_challenge_lookup",
  "request_count_lookup",
  "dispatch_claim"
]);
const SAFE_SMS_OTP_ROUTE_COMPONENTS = Object.freeze([
  "session_lookup",
  "role_check",
  "request_body",
  "request_schema",
  "service_dispatch"
]);
const SAFE_SMS_OTP_ROUTE_STATUSES = Object.freeze(["started", "ready", "failed"]);
const SAFE_SMS_OTP_ROUTE_HTTP_STATUSES = Object.freeze([400, 401, 403, 404, 409, 410, 429, 503]);
const SAFE_SMS_OTP_DATABASE_ERROR_CATEGORIES = Object.freeze([
  "table_missing",
  "column_missing",
  "connection_unavailable",
  "timeout",
  "query_rejected",
  "unknown"
]);
const SAFE_SMS_OTP_PROVIDER_ERROR_CATEGORIES = Object.freeze([
  "not_applicable",
  "provider_authentication",
  "provider_invalid_response",
  "provider_network",
  "provider_rate_limited",
  "provider_rejected",
  "provider_timeout",
  "provider_unavailable"
]);
const SAFE_DIAGNOSTIC_KEYS = Object.freeze([
  "stage",
  "applicationHttpStatus",
  "providerHttpStatus",
  "providerErrorCode",
  "providerErrorCategory",
  "preflightComponent",
  "databaseErrorCategory"
]);

function getSafeFailurePayload(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
    throw new Error("SMS OTP request diagnostic is invalid.");
  }
  if (Object.keys(diagnostic).some((key) => !SAFE_DIAGNOSTIC_KEYS.includes(key))) {
    throw new Error("SMS OTP request diagnostic field is not allowlisted.");
  }
  if (!SAFE_SMS_OTP_REQUEST_STAGES.includes(diagnostic.stage)) {
    throw new Error("SMS OTP request diagnostic stage is not allowlisted.");
  }
  if (![400, 503].includes(diagnostic.applicationHttpStatus)) {
    throw new Error("SMS OTP request application status is not allowlisted.");
  }
  if (
    diagnostic.providerHttpStatus !== null &&
    (!Number.isInteger(diagnostic.providerHttpStatus) ||
      diagnostic.providerHttpStatus < 100 ||
      diagnostic.providerHttpStatus > 599)
  ) {
    throw new Error("SMS OTP request provider status is not allowlisted.");
  }
  if (diagnostic.providerErrorCode !== null) {
    throw new Error("SMS OTP request provider error code is not allowlisted.");
  }
  if (!SAFE_SMS_OTP_PROVIDER_ERROR_CATEGORIES.includes(diagnostic.providerErrorCategory)) {
    throw new Error("SMS OTP request provider category is not allowlisted.");
  }

  const isPreflight = diagnostic.stage === "request_preflight";
  if (
    isPreflight !== SAFE_SMS_OTP_PREFLIGHT_COMPONENTS.includes(diagnostic.preflightComponent) ||
    isPreflight !== SAFE_SMS_OTP_DATABASE_ERROR_CATEGORIES.includes(diagnostic.databaseErrorCategory)
  ) {
    throw new Error("SMS OTP request preflight diagnostic is not allowlisted.");
  }
  if (
    isPreflight &&
    (diagnostic.applicationHttpStatus !== 503 ||
      diagnostic.providerHttpStatus !== null ||
      diagnostic.providerErrorCategory !== "not_applicable")
  ) {
    throw new Error("SMS OTP request preflight status is invalid.");
  }

  const providerReached = diagnostic.stage === "request_provider" || diagnostic.stage === "verify_provider";
  if (providerReached === (diagnostic.providerErrorCategory === "not_applicable")) {
    throw new Error("SMS OTP request provider diagnostic is invalid.");
  }
  if (!providerReached && diagnostic.providerHttpStatus !== null) {
    throw new Error("SMS OTP request provider status is misplaced.");
  }

  return {
    stage: diagnostic.stage,
    status: "failed",
    ...(isPreflight ? { preflightComponent: diagnostic.preflightComponent } : {}),
    ...(isPreflight ? { databaseErrorCategory: diagnostic.databaseErrorCategory } : {}),
    applicationHttpStatus: diagnostic.applicationHttpStatus,
    ...(diagnostic.providerHttpStatus === null
      ? {}
      : { providerHttpStatus: diagnostic.providerHttpStatus }),
    ...(providerReached ? { providerErrorCategory: diagnostic.providerErrorCategory } : {})
  };
}

function getSafeRoutePayload(routeStatus) {
  if (!routeStatus || typeof routeStatus !== "object" || Array.isArray(routeStatus)) {
    throw new Error("SMS OTP request route status is invalid.");
  }
  if (
    Object.keys(routeStatus).some(
      (key) => !["routeComponent", "status", "applicationHttpStatus"].includes(key)
    )
  ) {
    throw new Error("SMS OTP request route status field is not allowlisted.");
  }
  if (!SAFE_SMS_OTP_ROUTE_COMPONENTS.includes(routeStatus.routeComponent)) {
    throw new Error("SMS OTP request route component is not allowlisted.");
  }
  if (!SAFE_SMS_OTP_ROUTE_STATUSES.includes(routeStatus.status)) {
    throw new Error("SMS OTP request route status is not allowlisted.");
  }

  const failed = routeStatus.status === "failed";
  if (
    failed !== SAFE_SMS_OTP_ROUTE_HTTP_STATUSES.includes(routeStatus.applicationHttpStatus)
  ) {
    throw new Error("SMS OTP request route HTTP status is invalid.");
  }

  return {
    stage: "request_route",
    status: routeStatus.status,
    routeComponent: routeStatus.routeComponent,
    ...(failed ? { applicationHttpStatus: routeStatus.applicationHttpStatus } : {})
  };
}

function writePleskSmsOtpRequestStatus({
  rootDir,
  env = process.env,
  nodeEnv = env?.NODE_ENV,
  fallbackRootDir = process.cwd(),
  eventName,
  diagnostic,
  routeStatus,
  now = () => new Date()
}) {
  const applicationRoot = resolvePleskApplicationRoot({
    rootDir,
    env,
    nodeEnv,
    fallbackRootDir
  });

  let event;
  if (eventName === "diagnostics_probe_ready" && diagnostic === undefined) {
    event = { stage: "diagnostics_probe", status: "ready" };
  } else if (eventName === "request_failed") {
    event = getSafeFailurePayload(diagnostic);
  } else if (eventName === "request_route_status" && diagnostic === undefined) {
    event = getSafeRoutePayload(routeStatus);
  } else {
    throw new Error("SMS OTP request status event is not allowlisted.");
  }

  const updatedAt = now();
  if (!(updatedAt instanceof Date) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("SMS OTP request status time is invalid.");
  }

  const { directory, destination } = resolveRuntimePrivateDestination({
    applicationRoot,
    relativePath: SMS_OTP_REQUEST_STATUS_RELATIVE_PATH
  });
  const temporary = `${destination}.${process.pid}.tmp`;
  const payload = {
    version: 1,
    component: "sms_otp_request",
    ...event,
    updatedAt: updatedAt.toISOString()
  };

  fs.mkdirSync(directory, { mode: 0o700, recursive: true });
  fs.chmodSync(directory, 0o700);

  try {
    fs.writeFileSync(temporary, `${JSON.stringify(payload)}\n`, {
      encoding: "utf8",
      flag: "w",
      mode: 0o600
    });
    fs.renameSync(temporary, destination);
    fs.chmodSync(destination, 0o600);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // Best-effort cleanup only; diagnostics must not expose the underlying writer error.
    }
    throw error;
  }

  return destination;
}

module.exports = {
  SAFE_SMS_OTP_DATABASE_ERROR_CATEGORIES,
  SAFE_SMS_OTP_PREFLIGHT_COMPONENTS,
  SAFE_SMS_OTP_PROVIDER_ERROR_CATEGORIES,
  SAFE_SMS_OTP_ROUTE_COMPONENTS,
  SAFE_SMS_OTP_ROUTE_STATUSES,
  SAFE_SMS_OTP_REQUEST_STAGES,
  SMS_OTP_REQUEST_STATUS_RELATIVE_PATH,
  writePleskSmsOtpRequestStatus
};
