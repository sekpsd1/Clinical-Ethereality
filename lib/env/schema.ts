import { z } from "zod";

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

export const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Clinical Ethereality"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().default("clinical-ethereality"),
  JWT_ACCESS_TOKEN_TTL: z.string().default("15m"),
  JWT_REFRESH_TOKEN_TTL: z.string().default("30d"),
  NEXT_PUBLIC_LINE_LIFF_ID: z.string().optional(),
  LINE_CHANNEL_ID: z.string().optional(),
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_LOGIN_CALLBACK_URL: z.string().url().optional(),
  THAI_QR_PROMPTPAY_ID: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  STORE_RESERVATION_CLEANUP_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32).optional()
  ),
  SLIP_VERIFICATION_PROVIDER: z.enum(["slipok", "easyslip"]).optional(),
  SLIP_VERIFICATION_API_URL: z.string().url().optional(),
  SLIP_VERIFICATION_API_KEY: z.string().optional(),
  SLIPOK_BRANCH_ID: z.string().optional(),
  SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: z.string().optional(),
  EASYSLIP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(10_000),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  STAFF_UPLOAD_DIR: z.string().optional(),
  COMMUNITY_UPLOAD_DIR: z.string().optional(),
  PAYMENT_UPLOAD_DIR: z.string().optional(),
  SENTRY_DSN: optionalUrl,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
  ZOOM_MEETING_SDK_CLIENT_ID: z.string().optional(),
  ZOOM_MEETING_SDK_CLIENT_SECRET: z.string().optional(),
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
  ZOOM_HOST_USER_ID: z.string().optional(),
  ZOOM_WEBHOOK_SECRET: z.string().optional(),
  ENABLE_DEV_AUTH_BYPASS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true")
});

export type AppEnv = z.infer<typeof envSchema>;

export function getAppEnv(): AppEnv {
  return envSchema.parse(process.env);
}
