import { z } from "zod";

const opaqueIdSchema = z.string().trim().min(1).max(191);

export const previewConsultationTestResetSchema = z.object({
  consultationId: opaqueIdSchema
});

export const consultationTestResetSchema = z
  .object({
    consultationId: opaqueIdSchema,
    confirmedConsultationId: opaqueIdSchema,
    expectedStatus: z.enum([
      "requested",
      "pending_payment",
      "reschedule_required",
      "scheduled",
      "live"
    ]),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    reason: z.literal("test_data_reset")
  })
  .refine((value) => value.consultationId === value.confirmedConsultationId, {
    message: "Target confirmation does not match.",
    path: ["confirmedConsultationId"]
  });

export type ConsultationTestResetInput = z.infer<typeof consultationTestResetSchema>;
