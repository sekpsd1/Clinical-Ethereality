import { z } from "zod";

export const transitionDoctorConsultationSchema = z
  .object({
    consultationId: z.string().min(1),
    transition: z.enum(["start", "complete"]),
    summary: z.string().trim().max(4000).optional()
  })
  .superRefine((value, context) => {
    if (value.transition === "complete" && (!value.summary || value.summary.length < 5)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Consultation summary is required.",
        path: ["summary"]
      });
    }
  });
