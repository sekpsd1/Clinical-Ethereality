import { z } from "zod";

export const transitionDoctorConsultationSchema = z
  .object({
    consultationId: z.string().min(1),
    transition: z.enum(["start", "complete", "complete_no_show"]),
    summary: z.string().trim().max(4000).optional(),
    noShowReason: z.enum(["customer_did_not_join"]).optional()
  })
  .superRefine((value, context) => {
    if (value.transition === "complete" && (!value.summary || value.summary.length < 5)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Consultation summary is required.",
        path: ["summary"]
      });
    }

    if (value.transition === "complete_no_show" && value.noShowReason !== "customer_did_not_join") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A controlled no-show reason is required.",
        path: ["noShowReason"]
      });
    }

    if (value.transition === "complete_no_show" && value.summary) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No-show completion must not create clinical advice.",
        path: ["summary"]
      });
    }
  });
