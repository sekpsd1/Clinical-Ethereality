import { describe, expect, it } from "vitest";
import {
  DEFAULT_OTP_RETRY_AFTER_SECONDS,
  resolveOtpRetryAfterSeconds
} from "@/features/identity-verification/otp-retry";

describe("booking identity OTP retry delay", () => {
  it("prefers a valid response-body delay and rounds it up", () => {
    expect(resolveOtpRetryAfterSeconds({
      status: 429,
      bodyValue: 17.2,
      headerValue: "45"
    })).toBe(18);
  });

  it("accepts Retry-After seconds and HTTP dates", () => {
    expect(resolveOtpRetryAfterSeconds({
      status: 503,
      bodyValue: undefined,
      headerValue: "23"
    })).toBe(23);

    const nowMs = Date.parse("2026-09-11T07:00:00.000Z");
    expect(resolveOtpRetryAfterSeconds({
      status: 503,
      bodyValue: undefined,
      headerValue: "Fri, 11 Sep 2026 07:00:42 GMT",
      nowMs
    })).toBe(42);
  });

  it("uses a safe fallback for a rate limit with missing or invalid metadata", () => {
    expect(resolveOtpRetryAfterSeconds({
      status: 429,
      bodyValue: 0,
      headerValue: "invalid"
    })).toBe(DEFAULT_OTP_RETRY_AFTER_SECONDS);
  });

  it("does not imply possible delivery for a generic 503 without retry metadata", () => {
    expect(resolveOtpRetryAfterSeconds({
      status: 503,
      bodyValue: undefined,
      headerValue: null
    })).toBeNull();
  });

  it("does not invent a cooldown for non-retryable failures and caps excessive values", () => {
    expect(resolveOtpRetryAfterSeconds({
      status: 400,
      bodyValue: undefined,
      headerValue: null
    })).toBeNull();
    expect(resolveOtpRetryAfterSeconds({
      status: 429,
      bodyValue: 99_999,
      headerValue: null
    })).toBe(3_600);
  });
});
