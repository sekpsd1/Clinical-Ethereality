const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_ENDPOINT =
  "https://app.bccgroup-thailand.com/api/jobs/store-reservation-cleanup";
const DEFAULT_ALERT_AFTER_MINUTES = 15;
const DEFAULT_TIMEOUT_MS = 30_000;
const LOCK_STALE_AFTER_MS = 2 * 60 * 1000;
const STATUS_FILE_NAME = "status.json";
const LOCK_FILE_NAME = "runner.lock";

function getStateDirectory(env = process.env) {
  return (
    env.STORE_RESERVATION_CLEANUP_STATE_DIR ||
    path.join(os.tmpdir(), "clinical-ethereality-store-reservation-cleanup")
  );
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function readStatus(stateDirectory) {
  try {
    const value = JSON.parse(
      fs.readFileSync(path.join(stateDirectory, STATUS_FILE_NAME), "utf8"),
    );

    return value && typeof value === "object" ? value : null;
  } catch (error) {
    if (error && (error.code === "ENOENT" || error instanceof SyntaxError)) {
      return null;
    }

    throw error;
  }
}

function writeStatus(stateDirectory, status) {
  fs.mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const destination = path.join(stateDirectory, STATUS_FILE_NAME);
  const temporary = `${destination}.${process.pid}.tmp`;

  fs.writeFileSync(temporary, `${JSON.stringify(status)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporary, destination);
}

function getReadiness(status, now, alertAfterMinutes) {
  if (!status?.lastSuccessAt) {
    return {
      ready: false,
      reason: "last_success_missing",
      ageMinutes: null,
    };
  }

  const lastSuccessTime = Date.parse(status.lastSuccessAt);

  if (!Number.isFinite(lastSuccessTime)) {
    return {
      ready: false,
      reason: "last_success_invalid",
      ageMinutes: null,
    };
  }

  const ageMinutes = Math.max(0, (now.getTime() - lastSuccessTime) / 60_000);

  return {
    ready: ageMinutes <= alertAfterMinutes,
    reason: ageMinutes <= alertAfterMinutes ? "ready" : "last_success_stale",
    ageMinutes: Math.floor(ageMinutes),
  };
}

function acquireLock(stateDirectory, now) {
  fs.mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const lockPath = path.join(stateDirectory, LOCK_FILE_NAME);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = fs.openSync(lockPath, "wx", 0o600);
      fs.writeFileSync(descriptor, `${JSON.stringify({ startedAt: now.toISOString() })}\n`);
      return { descriptor, lockPath };
    } catch (error) {
      if (!error || error.code !== "EEXIST") {
        throw error;
      }

      const ageMilliseconds = now.getTime() - fs.statSync(lockPath).mtimeMs;

      if (attempt === 0 && ageMilliseconds > LOCK_STALE_AFTER_MS) {
        fs.unlinkSync(lockPath);
        continue;
      }

      return null;
    }
  }

  return null;
}

function releaseLock(lock) {
  if (!lock) {
    return;
  }

  try {
    fs.closeSync(lock.descriptor);
  } finally {
    try {
      fs.unlinkSync(lock.lockPath);
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function normalizeResult(payload) {
  const result = payload?.result;

  if (payload?.ok !== true || !result) {
    throw new Error("cleanup_response_invalid");
  }

  for (const key of ["candidates", "released", "skipped"]) {
    if (!Number.isSafeInteger(result[key]) || result[key] < 0) {
      throw new Error("cleanup_response_invalid");
    }
  }

  return {
    candidates: result.candidates,
    released: result.released,
    skipped: result.skipped,
  };
}

function safeFailureCode(error) {
  if (error?.name === "AbortError") {
    return "request_timeout";
  }

  if (error?.message === "cleanup_response_invalid") {
    return "response_invalid";
  }

  return "request_failed";
}

async function runCleanupJob({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  log = console.log,
  error = console.error,
} = {}) {
  const startedAt = now();
  const stateDirectory = getStateDirectory(env);
  const endpoint = env.STORE_RESERVATION_CLEANUP_URL || DEFAULT_ENDPOINT;
  const alertAfterMinutes = parsePositiveInteger(
    env.STORE_RESERVATION_CLEANUP_ALERT_AFTER_MINUTES,
    DEFAULT_ALERT_AFTER_MINUTES,
    "STORE_RESERVATION_CLEANUP_ALERT_AFTER_MINUTES",
  );
  const timeoutMs = parsePositiveInteger(
    env.STORE_RESERVATION_CLEANUP_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    "STORE_RESERVATION_CLEANUP_TIMEOUT_MS",
  );
  const secret = env.STORE_RESERVATION_CLEANUP_SECRET;

  if (!secret) {
    error(
      JSON.stringify({
        event: "store_reservation_cleanup_config_error",
        code: "secret_missing",
        key: "STORE_RESERVATION_CLEANUP_SECRET",
      }),
    );
    return { exitCode: 1, code: "secret_missing" };
  }

  let endpointUrl;

  try {
    endpointUrl = new URL(endpoint);
  } catch {
    error(
      JSON.stringify({
        event: "store_reservation_cleanup_config_error",
        code: "endpoint_invalid",
      }),
    );
    return { exitCode: 1, code: "endpoint_invalid" };
  }

  const lock = acquireLock(stateDirectory, startedAt);

  if (!lock) {
    log(
      JSON.stringify({
        event: "store_reservation_cleanup_skipped",
        code: "runner_locked",
      }),
    );
    return { exitCode: 0, code: "runner_locked" };
  }

  const previousStatus = readStatus(stateDirectory);
  const previousReadiness = getReadiness(
    previousStatus,
    startedAt,
    alertAfterMinutes,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpointUrl, {
      method: "POST",
      headers: {
        "x-clinical-job-secret": secret,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("cleanup_request_failed");
    }

    const result = normalizeResult(await response.json());
    const completedAt = now();
    const status = {
      version: 1,
      lastAttemptAt: startedAt.toISOString(),
      lastSuccessAt: completedAt.toISOString(),
      endpointHost: endpointUrl.host,
      result,
    };

    writeStatus(stateDirectory, status);
    log(
      JSON.stringify({
        event: "store_reservation_cleanup_succeeded",
        completedAt: status.lastSuccessAt,
        result,
      }),
    );

    if (
      previousStatus?.lastSuccessAt &&
      previousReadiness.reason === "last_success_stale"
    ) {
      error(
        JSON.stringify({
          event: "store_reservation_cleanup_recovered_after_stale",
          previousAgeMinutes: previousReadiness.ageMinutes,
          alertAfterMinutes,
        }),
      );
      return { exitCode: 2, code: "recovered_after_stale", status };
    }

    return { exitCode: 0, code: "succeeded", status };
  } catch (caught) {
    const failedAt = now();
    const code = safeFailureCode(caught);
    const status = {
      version: 1,
      lastAttemptAt: startedAt.toISOString(),
      lastSuccessAt: previousStatus?.lastSuccessAt || null,
      lastFailureAt: failedAt.toISOString(),
      lastFailureCode: code,
      endpointHost: endpointUrl.host,
      result: previousStatus?.result || null,
    };

    writeStatus(stateDirectory, status);
    error(
      JSON.stringify({
        event: "store_reservation_cleanup_failed",
        code,
        lastSuccessAt: status.lastSuccessAt,
      }),
    );
    return { exitCode: 1, code, status };
  } finally {
    clearTimeout(timeout);
    releaseLock(lock);
  }
}

function checkReadiness({
  env = process.env,
  now = new Date(),
  log = console.log,
  error = console.error,
} = {}) {
  const alertAfterMinutes = parsePositiveInteger(
    env.STORE_RESERVATION_CLEANUP_ALERT_AFTER_MINUTES,
    DEFAULT_ALERT_AFTER_MINUTES,
    "STORE_RESERVATION_CLEANUP_ALERT_AFTER_MINUTES",
  );
  const readiness = getReadiness(
    readStatus(getStateDirectory(env)),
    now,
    alertAfterMinutes,
  );
  const output = {
    event: "store_reservation_cleanup_readiness",
    ready: readiness.ready,
    reason: readiness.reason,
    ageMinutes: readiness.ageMinutes,
    alertAfterMinutes,
  };

  (readiness.ready ? log : error)(JSON.stringify(output));
  return { exitCode: readiness.ready ? 0 : 1, ...output };
}

async function main() {
  const result = process.argv.includes("--check-readiness")
    ? checkReadiness()
    : await runCleanupJob();

  process.exitCode = result.exitCode;
}

if (require.main === module) {
  void main().catch(() => {
    console.error(
      JSON.stringify({
        event: "store_reservation_cleanup_failed",
        code: "runner_unexpected_failure",
      }),
    );
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_ALERT_AFTER_MINUTES,
  DEFAULT_ENDPOINT,
  LOCK_STALE_AFTER_MS,
  checkReadiness,
  getReadiness,
  getStateDirectory,
  readStatus,
  runCleanupJob,
};
