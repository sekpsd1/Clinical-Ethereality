import { z } from "zod";

export const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Clinical Ethereality"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_LINE_LIFF_ID: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;
