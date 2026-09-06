import { z } from "zod";

export const updatePharmacistOrderSchema = z.object({
  orderId: z.string().min(1),
  action: z.enum(["mark_preparing", "mark_shipped", "mark_delivered"]),
  carrier: z.string().trim().max(80).optional().transform((value) => value || undefined),
  trackingNumber: z.string().trim().max(100).optional().transform((value) => value || undefined)
}).superRefine((value, context) => {
  if (
    value.action === "mark_shipped" &&
    (!value.trackingNumber ||
      value.trackingNumber.length < 3 ||
      !/^[\p{L}\p{N}][\p{L}\p{N}._/# -]*$/u.test(value.trackingNumber))
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["trackingNumber"],
      message: "กรุณากรอกเลขพัสดุที่ถูกต้อง"
    });
  }
});
