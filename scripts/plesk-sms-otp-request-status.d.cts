import type { SmsOtpRouteStatusEvent, SmsOtpSafeDiagnostic } from "../lib/sms/otp";

export const SMS_OTP_REQUEST_STATUS_RELATIVE_PATH: string;
export const SAFE_SMS_OTP_REQUEST_STAGES: readonly string[];
export const SAFE_SMS_OTP_PREFLIGHT_COMPONENTS: readonly string[];
export const SAFE_SMS_OTP_DATABASE_ERROR_CATEGORIES: readonly string[];
export const SAFE_SMS_OTP_PROVIDER_ERROR_CATEGORIES: readonly string[];
export const SAFE_SMS_OTP_ROUTE_COMPONENTS: readonly string[];
export const SAFE_SMS_OTP_ROUTE_STATUSES: readonly string[];

export function writePleskSmsOtpRequestStatus(input: {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string;
  fallbackRootDir?: string;
  eventName: "diagnostics_probe_ready" | "request_failed" | "request_route_status";
  diagnostic?: SmsOtpSafeDiagnostic;
  routeStatus?: SmsOtpRouteStatusEvent;
  now?: () => Date;
}): string;
