import { z } from "zod";

export const resetCustomerAssessmentsSchema = z.object({
  customerId: z.string().min(1)
});

const opaqueIdSchema = z.string().trim().min(1).max(191);

export const previewCustomerTestResetSchema = z.object({
  customerId: opaqueIdSchema
});

export const customerTestResetSchema = z
  .object({
    customerId: opaqueIdSchema,
    confirmedCustomerId: opaqueIdSchema,
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    confirmationText: z.string().trim().min(1).max(120)
  })
  .refine((value) => value.customerId === value.confirmedCustomerId, {
    message: "Target confirmation does not match.",
    path: ["confirmedCustomerId"]
  });
