import { z } from "zod";
import { assessmentSymptomDetailMaxLength } from "@/features/consultations/assessment/constants";

export const submitConsultAssessmentSchema = z.object({
  symptom: z.enum(["rash_or_sore", "itching_or_redness", "urinary_symptoms", "other"]),
  symptomDetail: z.string().trim().max(assessmentSymptomDetailMaxLength).optional(),
  duration: z.enum(["less24h", "1-3days", "more3days"])
}).superRefine((data, context) => {
  if (data.symptom === "other" && !data.symptomDetail) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "กรุณาระบุอาการอื่นๆ",
      path: ["symptomDetail"]
    });
  }
});
