export const DEFAULT_OTP_RETRY_AFTER_SECONDS = 60;
const MAX_OTP_RETRY_AFTER_SECONDS = 60 * 60;

function normalizeRetryAfterSeconds(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(Math.ceil(parsed), MAX_OTP_RETRY_AFTER_SECONDS);
}

function parseRetryAfterHeader(value: string | null, nowMs: number): number | null {
  if (!value) return null;

  const seconds = normalizeRetryAfterSeconds(value);
  if (seconds !== null) return seconds;

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt) || retryAt <= nowMs) {
    return null;
  }

  return normalizeRetryAfterSeconds((retryAt - nowMs) / 1_000);
}

export function resolveOtpRetryAfterSeconds({
  status,
  bodyValue,
  headerValue,
  nowMs = Date.now()
}: {
  status: number;
  bodyValue: unknown;
  headerValue: string | null;
  nowMs?: number;
}): number | null {
  const bodySeconds = normalizeRetryAfterSeconds(bodyValue);
  if (bodySeconds !== null) return bodySeconds;

  const headerSeconds = parseRetryAfterHeader(headerValue, nowMs);
  if (headerSeconds !== null) return headerSeconds;

  // Older request-route responses may omit Retry-After for a 429. Do not
  // invent a cooldown for a generic 503: configuration/database failures do
  // not necessarily retain a dispatch claim and must not imply SMS delivery.
  return status === 429 ? DEFAULT_OTP_RETRY_AFTER_SECONDS : null;
}
