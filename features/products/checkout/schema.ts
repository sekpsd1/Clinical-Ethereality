import { z } from "zod";

export const checkoutSchema = z.object({
  checkoutRequestId: z.string().uuid()
});
