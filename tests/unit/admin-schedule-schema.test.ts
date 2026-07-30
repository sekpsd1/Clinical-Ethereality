import { describe, expect, it } from "vitest";
import { upsertDoctorAvailabilitySchema } from "@/features/admin/schedules/schema";

const validSchedule = {
  availabilityId: "availability-1",
  doctorId: "doctor-1",
  weekday: "1",
  startTime: "09:00",
  endTime: "12:00",
  slotMinutes: "30",
  isActive: "true",
  notes: "ติดตามอาการ"
};

describe("admin schedule schema", () => {
  it("accepts an existing availability ID for editing", () => {
    const result = upsertDoctorAvailabilitySchema.safeParse(validSchedule);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      availabilityId: "availability-1",
      weekday: 1,
      slotMinutes: 30,
      isActive: true
    });
  });

  it("rejects an end time that is not after the start time", () => {
    const result = upsertDoctorAvailabilitySchema.safeParse({
      ...validSchedule,
      startTime: "12:00",
      endTime: "09:00"
    });

    expect(result.success).toBe(false);
  });
});
