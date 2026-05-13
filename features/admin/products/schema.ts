import { z } from "zod";

const priceField = z.coerce.number().min(0).max(999999);

export const upsertProductSchema = z.object({
  productId: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  price: priceField,
  status: z.enum(["draft", "active", "archived"]),
  requiresPrescription: z.preprocess((value) => value === "on" || value === "true", z.boolean())
});
