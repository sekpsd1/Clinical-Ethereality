import type { SmsOtpSafeDiagnostic } from "../lib/sms/otp";

export const SMS_OTP_REQUEST_STATUS_RELATIVE_PATH: string;
export const SAFE_SMS_OTP_REQUEST_STAGES: readonly string[];
export const SAFE_SMS_OTP_PREFLIGHT_COMPONENTS: readonly string[];
export const SAFE_SMS_OTP_DATABASE_ERROR_CATEGORIES: readonly string[];
export const SAFE_SMS_OTP_PROVIDER_ERROR_CATEGORIES: readonly string[];

export function writePleskSmsOtpRequestStatus(input: {
  rootDir: string;
  eventName: "diagnostics_probe_ready" | "request_failed";
  diagnostic?: SmsOtpSafeDiagnostic;
  now?: () => Date;
}): string;
