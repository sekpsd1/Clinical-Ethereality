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

  it("requests an OTP with the provider-required URL-encoded body and returns only challenge metadata", async () => {
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
    const form = init?.body as URLSearchParams;
    const headers = new Headers(init?.headers);
    expect(form).toBeInstanceOf(URLSearchParams);
    expect(form.get("msisdn")).toBe("0812345678");
    expect(form.get("key")).toBe("test-key");
    expect(form.get("secret")).toBe("test-secret");
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://otp.thaibulksms.com/v2/otp/request");
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
    const [, verifyInit] = successfulFetch.mock.calls[0]!;
    const verifyForm = verifyInit?.body as URLSearchParams;
    expect(verifyForm).toBeInstanceOf(URLSearchParams);
    expect(verifyForm.get("token")).toBe("challenge-token");
    expect(verifyForm.get("pin")).toBe("123456");
    expect(new Headers(verifyInit?.headers).get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(successfulFetch.mock.calls[0]?.[0]).toBe("https://otp.thaibulksms.com/v2/otp/verify");
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
    const diagnostics = vi.fn();
    await expect(
      verifySmsOtp("challenge-token", "123456", {
        env: configuredEnv,
        fetchImpl: malformedFetch,
        diagnosticLogger: diagnostics
      })
    ).rejects.toMatchObject({ code: "PROVIDER_REJECTED" });
    expect(diagnostics).toHaveBeenCalledWith({
      stage: "verify_provider",
      applicationHttpStatus: 400,
      providerHttpStatus: 200,
      providerErrorCode: null,
      providerErrorCategory: "provider_invalid_response"
    });
  });

  it("classifies provider rejection without reading or logging the raw response", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "UNTRUSTED_RAW_CODE",
          message: "phone=0812345678 secret=must-not-escape",
          token: "must-not-escape",
          refno: "must-not-escape"
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      )
    );
    const diagnostics = vi.fn();

    await expect(
      requestSmsOtp("0812345678", { env: configuredEnv, fetchImpl, diagnosticLogger: diagnostics })
    ).rejects.toMatchObject({ code: "PROVIDER_REJECTED" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(diagnostics).toHaveBeenCalledWith({
      stage: "request_provider",
      applicationHttpStatus: 400,
      providerHttpStatus: 400,
      providerErrorCode: null,
      providerErrorCategory: "provider_rejected"
    });
    const serializedDiagnostics = JSON.stringify(diagnostics.mock.calls);
    expect(serializedDiagnostics).not.toContain("0812345678");
    expect(serializedDiagnostics).not.toContain("must-not-escape");
    expect(serializedDiagnostics).not.toContain("UNTRUSTED_RAW_CODE");
  });

  it("classifies provider outages and timeouts without retrying", async () => {
    const outageFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status: 503 }));
    const outageDiagnostics = vi.fn();

    await expect(
      requestSmsOtp("0812345678", {
        env: configuredEnv,
        fetchImpl: outageFetch,
        diagnosticLogger: outageDiagnostics
      })
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(outageFetch).toHaveBeenCalledTimes(1);
    expect(outageDiagnostics).toHaveBeenCalledWith({
      stage: "request_provider",
      applicationHttpStatus: 503,
      providerHttpStatus: 503,
      providerErrorCode: null,
      providerErrorCategory: "provider_unavailable"
    });

    const timeoutError = Object.assign(new Error("secret=must-not-escape"), { name: "TimeoutError" });
    const timeoutFetch = vi.fn<typeof fetch>().mockRejectedValue(timeoutError);
    const timeoutDiagnostics = vi.fn();

    await expect(
      requestSmsOtp("0812345678", {
        env: configuredEnv,
        fetchImpl: timeoutFetch,
        diagnosticLogger: timeoutDiagnostics
      })
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    expect(timeoutFetch).toHaveBeenCalledTimes(1);
    expect(timeoutDiagnostics).toHaveBeenCalledWith({
      stage: "request_provider",
      applicationHttpStatus: 503,
      providerHttpStatus: null,
      providerErrorCode: null,
      providerErrorCategory: "provider_timeout"
    });
    expect(JSON.stringify(timeoutDiagnostics.mock.calls)).not.toContain("must-not-escape");
  });

  it("does not call the provider without complete owner-managed credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      requestSmsOtp("0812345678", { env: buildEnv(), fetchImpl })
    ).rejects.toEqual(new SmsOtpError("CONFIGURATION_ERROR"));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
