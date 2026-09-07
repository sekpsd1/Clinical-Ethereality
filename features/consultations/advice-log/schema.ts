import { z } from "zod";

export const adviceLogConsultationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
