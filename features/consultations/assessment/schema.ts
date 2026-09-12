import { z } from "zod";
import { assessmentSymptomDetailMaxLength } from "@/features/consultations/assessment/constants";

export const submitConsultAssessmentSchema = z.object({
  symptom: z.enum(["rash_or_sore", "itching_or_redness", "urinary_symptoms", "other"]),
  symptomDetail: z.string().trim().max(assessmentSymptomDetailMaxLength).optional(),
  duration: z.enum(["less24h", "1-3days", "more3days"]),
  doctorId: z.string().cuid().optional()
}).superRefine((data, context) => {
  if (data.symptom === "other" && !data.symptomDetail) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "กรุณาระบุอาการอื่นๆ",
      path: ["symptomDetail"]
    });
  }
});

export const acceptConsultAssessmentHealthConsentSchema = z.object({
  healthDataConsentAccepted: z.literal("on"),
  version: z.string().trim().min(1),
  doctorId: z.string().cuid().optional()
});
