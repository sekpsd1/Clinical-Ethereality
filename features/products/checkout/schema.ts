import { z } from "zod";

export const checkoutSchema = z.object({
  productSlugs: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .pipe(z.array(z.string().min(1)).min(1).max(10))
});
