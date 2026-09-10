import { z } from "zod";

export const submitConsultAssessmentSchema = z.object({
  symptom: z.enum(["rash_or_sore", "itching_or_redness", "urinary_symptoms", "other"]),
  duration: z.enum(["less24h", "1-3days", "more3days"])
});
