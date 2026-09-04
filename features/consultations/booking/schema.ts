import { z } from "zod";

export const createConsultationBookingSchema = z.object({
  availabilityId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  // Optional only to keep existing bookmarked booking pages compatible. New
  // booking forms always submit it and the action verifies it against the slot.
  doctorId: z.string().cuid().optional()
});
