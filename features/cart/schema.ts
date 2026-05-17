import { z } from "zod";

export const cartMutationSchema = z.object({
  slug: z.string().min(1),
  quantity: z.coerce.number().int().min(0).max(10).default(1)
});
