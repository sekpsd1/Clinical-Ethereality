import { z } from "zod";

export const resetCustomerAssessmentsSchema = z.object({
  customerId: z.string().min(1)
});
