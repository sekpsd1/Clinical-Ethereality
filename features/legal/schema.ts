import { z } from "zod";

export const acceptConsentSchema = z.object({
  type: z.enum(["privacy_policy", "terms_of_service", "health_data", "teleconsultation", "prescription_fulfillment"]),
  version: z.string().min(1).max(80)
});
