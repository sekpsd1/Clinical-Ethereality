import { z } from "zod";

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
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  SLIP_VERIFICATION_PROVIDER: z.enum(["slipok", "easyslip"]).optional(),
  SLIP_VERIFICATION_API_URL: z.string().url().optional(),
  SLIP_VERIFICATION_API_KEY: z.string().optional(),
  SLIPOK_BRANCH_ID: z.string().optional(),
  SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME: z.string().optional(),
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
