import { z } from "zod";
import { productCategories } from "@/features/products/categories";

const priceField = z.coerce.number().min(0).max(999999);
const productCategoryValues = productCategories.map((category) => category.value) as [
  (typeof productCategories)[number]["value"],
  ...(typeof productCategories)[number]["value"][]
];

export const upsertProductSchema = z.object({
  productId: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(140)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(productCategoryValues),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  usageInstructions: z.string().trim().max(3000).optional(),
  fdaNumber: z.string().trim().max(120).optional(),
  warnings: z.string().trim().max(3000).optional(),
  storageInstructions: z.string().trim().max(2000).optional(),
  specialFulfillmentNotes: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  price: priceField,
  status: z.enum(["draft", "active", "archived"]),
  requiresPrescription: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  controlledOrRestricted: z.preprocess((value) => value === "on" || value === "true", z.boolean())
});
