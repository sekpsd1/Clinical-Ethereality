import { z } from "zod";

export const checkoutSchema = z.object({
  checkoutRequestId: z.string().uuid(),
  shippingAddressId: z.string().trim().min(1).max(191)
});
