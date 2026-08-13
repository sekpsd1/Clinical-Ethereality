import { z } from "zod";
import type { AppEnv } from "@/lib/env/schema";
import { getAppEnv } from "@/lib/env/schema";
import { maskThaiMobileNumber, normalizeThaiMobileNumber } from "@/lib/identity/thai-phone";

const thaiBulkSmsRequestUrl = "https://otp.thaibulksms.com/v2/otp/request";
const thaiBulkSmsVerifyUrl = "https://otp.thaibulksms.com/v2/otp/verify";
const otpCodePattern = /^\d{4,8}$/;

const requestResponseSchema = z.object({
  status: z.literal("success"),
  token: z.string().min(1).max(255),
  refno: z.string().min(1).max(64)
});

const verifyResponseSchema = z.object({
  status: z.literal("success"),
  message: z.string().optional()
});

export type SmsOtpReadiness = {
  provider: "thaibulksms" | "not_configured";
  isConfigured: boolean;
  configuredKeys: string[];
  missingKeys: string[];
};

export type SmsOtpChallenge = {
  provider: "thaibulksms";
  providerChallengeId: string;
  reference: string;
  phoneLabel: string;
};

export class SmsOtpError extends Error {
  constructor(
    public readonly code:
      | "CONFIGURATION_ERROR"
      | "INVALID_CODE"
      | "PROVIDER_REJECTED"
      | "PROVIDER_UNAVAILABLE"
  ) {
    super(code);
    this.name = "SmsOtpError";
  }
}

type OtpRequestOptions = {
  env?: AppEnv;
  fetchImpl?: typeof fetch;
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function getSmsOtpReadiness(env: AppEnv = getAppEnv()): SmsOtpReadiness {
  const checks: Array<[string, boolean]> = [
    ["SMS_OTP_PROVIDER", env.SMS_OTP_PROVIDER === "thaibulksms"],
    ["SMS_OTP_API_KEY", hasValue(env.SMS_OTP_API_KEY)],
    ["SMS_OTP_API_SECRET", hasValue(env.SMS_OTP_API_SECRET)]
  ];

  return {
    provider: env.SMS_OTP_PROVIDER ?? "not_configured",
    isConfigured: checks.every(([, configured]) => configured),
    configuredKeys: checks.filter(([, configured]) => configured).map(([key]) => key),
    missingKeys: checks.filter(([, configured]) => !configured).map(([key]) => key)
  };
}

function requireProviderConfig(env: AppEnv): { key: string; secret: string; timeoutMs: number } {
  if (
    env.SMS_OTP_PROVIDER !== "thaibulksms" ||
    !hasValue(env.SMS_OTP_API_KEY) ||
    !hasValue(env.SMS_OTP_API_SECRET)
  ) {
    throw new SmsOtpError("CONFIGURATION_ERROR");
  }

  return {
    key: env.SMS_OTP_API_KEY!,
    secret: env.SMS_OTP_API_SECRET!,
    timeoutMs: env.SMS_OTP_REQUEST_TIMEOUT_MS
  };
}

async function postOtpForm(
  url: string,
  fields: Record<string, string>,
  options: OtpRequestOptions
): Promise<unknown> {
  const env = options.env ?? getAppEnv();
  const config = requireProviderConfig(env);
  const form = new FormData();

  form.set("key", config.key);
  form.set("secret", config.secret);
  Object.entries(fields).forEach(([name, value]) => form.set(name, value));

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs)
    });

    if (!response.ok) {
      throw new SmsOtpError("PROVIDER_REJECTED");
    }

    return await response.json();
  } catch (error) {
    if (error instanceof SmsOtpError) {
      throw error;
    }

    throw new SmsOtpError("PROVIDER_UNAVAILABLE");
  }
}

export async function requestSmsOtp(
  phone: string,
  options: OtpRequestOptions = {}
): Promise<SmsOtpChallenge> {
  const normalizedPhone = normalizeThaiMobileNumber(phone);
  const payload = await postOtpForm(
    thaiBulkSmsRequestUrl,
    { msisdn: normalizedPhone.local },
    options
  );
  const parsed = requestResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new SmsOtpError("PROVIDER_REJECTED");
  }

  return {
    provider: "thaibulksms",
    providerChallengeId: parsed.data.token,
    reference: parsed.data.refno,
    phoneLabel: maskThaiMobileNumber(normalizedPhone.local)
  };
}

export async function verifySmsOtp(
  providerChallengeId: string,
  code: string,
  options: OtpRequestOptions = {}
): Promise<{ verified: true }> {
  if (!providerChallengeId.trim() || providerChallengeId.length > 255 || !otpCodePattern.test(code)) {
    throw new SmsOtpError("INVALID_CODE");
  }

  const payload = await postOtpForm(
    thaiBulkSmsVerifyUrl,
    { token: providerChallengeId, pin: code },
    options
  );
  const parsed = verifyResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new SmsOtpError("PROVIDER_REJECTED");
  }

  return { verified: true };
}
