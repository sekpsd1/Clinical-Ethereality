import { z } from "zod";

export const submitConsultAssessmentSchema = z.object({
  symptom: z.enum(["headache", "fever", "cough", "other"]),
  duration: z.enum(["less24h", "1-3days", "more3days"])
});
