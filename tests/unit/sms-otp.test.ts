import { describe, expect, it, vi } from "vitest";
import { envSchema } from "@/lib/env/schema";
import {
  InvalidThaiMobileNumberError,
  maskThaiMobileNumber,
  normalizeThaiMobileNumber
} from "@/lib/identity/thai-phone";
import {
  getSmsOtpReadiness,
  requestSmsOtp,
  SmsOtpError,
  verifySmsOtp
} from "@/lib/sms/otp";

function buildEnv(overrides: Record<string, string | undefined> = {}) {
  return envSchema.parse(overrides);
}

const configuredEnv = buildEnv({
  SMS_OTP_PROVIDER: "thaibulksms",
  SMS_OTP_API_KEY: "test-key",
  SMS_OTP_API_SECRET: "test-secret"
});

describe("Thai mobile number normalization", () => {
  it.each([
    ["081-234-5678", "0812345678", "+66812345678"],
    ["+66 81 234 5678", "0812345678", "+66812345678"],
    ["66812345678", "0812345678", "+66812345678"]
  ])("normalizes %s", (input, local, e164) => {
    expect(normalizeThaiMobileNumber(input)).toEqual({ local, e164 });
    expect(maskThaiMobileNumber(input)).toBe("081****678");
  });

  it.each(["", "021234567", "0512345678", "+441234567890", "not-a-phone"])(
    "rejects a non-Thai-mobile value: %s",
    (input) => {
      expect(() => normalizeThaiMobileNumber(input)).toThrow(InvalidThaiMobileNumberError);
    }
  );
});

describe("ThaiBulkSMS OTP adapter", () => {
  it("reports only configuration key names, never secret values", () => {
    expect(getSmsOtpReadiness(buildEnv())).toMatchObject({
      provider: "not_configured",
      isConfigured: false,
      missingKeys: ["SMS_OTP_PROVIDER", "SMS_OTP_API_KEY", "SMS_OTP_API_SECRET"]
    });
    expect(getSmsOtpReadiness(configuredEnv)).toMatchObject({
      provider: "thaibulksms",
      isConfigured: true,
      missingKeys: []
    });
  });

  it("requests an OTP with normalized form data and returns only the challenge metadata", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", token: "challenge-token", refno: "ABC12" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(
      requestSmsOtp("+66 81 234 5678", { env: configuredEnv, fetchImpl })
    ).resolves.toEqual({
      provider: "thaibulksms",
      providerChallengeId: "challenge-token",
      reference: "ABC12",
      phoneLabel: "081****678"
    });

    const [, init] = fetchImpl.mock.calls[0]!;
    const form = init?.body as FormData;
    expect(form.get("msisdn")).toBe("0812345678");
    expect(form.get("key")).toBe("test-key");
    expect(form.get("secret")).toBe("test-secret");
  });

  it("verifies only a numeric OTP and fails closed on malformed provider responses", async () => {
    const successfulFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", message: "Code is correct." }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(
      verifySmsOtp("challenge-token", "123456", { env: configuredEnv, fetchImpl: successfulFetch })
    ).resolves.toEqual({ verified: true });
    await expect(
      verifySmsOtp("challenge-token", "12ab", { env: configuredEnv, fetchImpl: successfulFetch })
    ).rejects.toEqual(new SmsOtpError("INVALID_CODE"));
    expect(successfulFetch).toHaveBeenCalledTimes(1);

    const malformedFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "failed", secret: "must-not-escape" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    await expect(
      verifySmsOtp("challenge-token", "123456", { env: configuredEnv, fetchImpl: malformedFetch })
    ).rejects.toEqual(new SmsOtpError("PROVIDER_REJECTED"));
  });

  it("does not call the provider without complete owner-managed credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      requestSmsOtp("0812345678", { env: buildEnv(), fetchImpl })
    ).rejects.toEqual(new SmsOtpError("CONFIGURATION_ERROR"));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
