import { z } from "zod";

export const createPrescriptionOrderSchema = z.object({
  prescriptionId: z.string().min(1),
  productId: z.string().min(1)
});

export const createExternalPrescriptionOrderSchema = z.object({
  productSlug: z.string().trim().min(1),
  attachmentUrl: z.string().trim().url(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(120).optional(),
  byteSize: z.coerce.number().int().positive().max(10 * 1024 * 1024).optional()
});
