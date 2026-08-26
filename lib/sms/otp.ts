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
      | "PROVIDER_UNAVAILABLE",
    public readonly diagnostic?: SmsOtpSafeDiagnostic
  ) {
    super(code);
    this.name = "SmsOtpError";
  }
}

type OtpRequestOptions = {
  env?: AppEnv;
  fetchImpl?: typeof fetch;
  diagnosticLogger?: SmsOtpDiagnosticLogger;
};

export type SmsOtpDiagnosticStage =
  | "request_schema"
  | "request_preflight"
  | "request_provider"
  | "request_persistence"
  | "verify_provider";

export type SmsOtpProviderErrorCategory =
  | "not_applicable"
  | "provider_authentication"
  | "provider_invalid_response"
  | "provider_network"
  | "provider_rate_limited"
  | "provider_rejected"
  | "provider_timeout"
  | "provider_unavailable";

export type SmsOtpSafeDiagnostic = {
  stage: SmsOtpDiagnosticStage;
  applicationHttpStatus: 400 | 503;
  providerHttpStatus: number | null;
  providerErrorCode: null;
  providerErrorCategory: SmsOtpProviderErrorCategory;
};

export type SmsOtpDiagnosticLogger = (diagnostic: SmsOtpSafeDiagnostic) => void;

export function writeSmsOtpDiagnostic(
  diagnostic: SmsOtpSafeDiagnostic,
  logger?: SmsOtpDiagnosticLogger
): void {
  if (logger) {
    logger(diagnostic);
    return;
  }

  console.error("[sms/otp] failed", diagnostic);
}

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

function getProviderErrorCategory(status: number): SmsOtpProviderErrorCategory {
  if (status === 401 || status === 403) return "provider_authentication";
  if (status === 429) return "provider_rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_rejected";
}

function isProviderUnavailableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}

function createProviderDiagnostic(
  stage: Extract<SmsOtpDiagnosticStage, "request_provider" | "verify_provider">,
  applicationHttpStatus: 400 | 503,
  providerHttpStatus: number | null,
  providerErrorCategory: SmsOtpProviderErrorCategory
): SmsOtpSafeDiagnostic {
  return {
    stage,
    applicationHttpStatus,
    providerHttpStatus,
    providerErrorCode: null,
    providerErrorCategory
  };
}

async function postOtpForm(
  stage: Extract<SmsOtpDiagnosticStage, "request_provider" | "verify_provider">,
  url: string,
  fields: Record<string, string>,
  options: OtpRequestOptions
): Promise<unknown> {
  const env = options.env ?? getAppEnv();
  const config = requireProviderConfig(env);
  const form = new URLSearchParams();

  form.set("key", config.key);
  form.set("secret", config.secret);
  Object.entries(fields).forEach(([name, value]) => form.set(name, value));

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(config.timeoutMs)
    });

    if (!response.ok) {
      const providerErrorCategory = getProviderErrorCategory(response.status);
      const unavailable = isProviderUnavailableStatus(response.status);
      const diagnostic = createProviderDiagnostic(
        stage,
        unavailable ? 503 : 400,
        response.status,
        providerErrorCategory
      );
      writeSmsOtpDiagnostic(diagnostic, options.diagnosticLogger);
      throw new SmsOtpError(unavailable ? "PROVIDER_UNAVAILABLE" : "PROVIDER_REJECTED", diagnostic);
    }

    try {
      return await response.json();
    } catch {
      const diagnostic = createProviderDiagnostic(
        stage,
        503,
        response.status,
        "provider_invalid_response"
      );
      writeSmsOtpDiagnostic(diagnostic, options.diagnosticLogger);
      throw new SmsOtpError("PROVIDER_UNAVAILABLE", diagnostic);
    }
  } catch (error) {
    if (error instanceof SmsOtpError) {
      throw error;
    }

    const diagnostic = createProviderDiagnostic(
      stage,
      503,
      null,
      isTimeoutError(error) ? "provider_timeout" : "provider_network"
    );
    writeSmsOtpDiagnostic(diagnostic, options.diagnosticLogger);
    throw new SmsOtpError("PROVIDER_UNAVAILABLE", diagnostic);
  }
}

export async function requestSmsOtp(
  phone: string,
  options: OtpRequestOptions = {}
): Promise<SmsOtpChallenge> {
  const normalizedPhone = normalizeThaiMobileNumber(phone);
  const payload = await postOtpForm(
    "request_provider",
    thaiBulkSmsRequestUrl,
    { msisdn: normalizedPhone.local },
    options
  );
  const parsed = requestResponseSchema.safeParse(payload);

  if (!parsed.success) {
    const diagnostic = createProviderDiagnostic(
      "request_provider",
      400,
      200,
      "provider_invalid_response"
    );
    writeSmsOtpDiagnostic(diagnostic, options.diagnosticLogger);
    throw new SmsOtpError("PROVIDER_REJECTED", diagnostic);
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
    "verify_provider",
    thaiBulkSmsVerifyUrl,
    { token: providerChallengeId, pin: code },
    options
  );
  const parsed = verifyResponseSchema.safeParse(payload);

  if (!parsed.success) {
    const diagnostic = createProviderDiagnostic(
      "verify_provider",
      400,
      200,
      "provider_invalid_response"
    );
    writeSmsOtpDiagnostic(diagnostic, options.diagnosticLogger);
    throw new SmsOtpError("PROVIDER_REJECTED", diagnostic);
  }

  return { verified: true };
}
