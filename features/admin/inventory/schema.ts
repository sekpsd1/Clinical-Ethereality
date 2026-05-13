import { z } from "zod";

const integerField = z.coerce.number().int().min(0).max(99999);

export const updateInventorySchema = z.object({
  inventoryId: z.string().min(1),
  quantity: integerField,
  lowStockThreshold: integerField
});
