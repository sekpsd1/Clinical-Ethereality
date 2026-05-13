import { z } from "zod";

export const createConsultationBookingSchema = z.object({
  availabilityId: z.string().min(1)
});
