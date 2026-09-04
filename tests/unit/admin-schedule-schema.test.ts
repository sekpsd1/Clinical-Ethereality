import { describe, expect, it } from "vitest";
import { createDoctorAvailabilityBatchSchema, upsertDoctorAvailabilitySchema } from "@/features/admin/schedules/schema";

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

  it("rejects a recurring availability range that ends before it starts", () => {
    const result = upsertDoctorAvailabilitySchema.safeParse({
      ...validSchedule,
      effectiveFrom: "2026-09-30",
      effectiveTo: "2026-09-01"
    });

    expect(result.success).toBe(false);
  });

  it("accepts multiple days with mixed slot durations when every block divides exactly", () => {
    const result = createDoctorAvailabilityBatchSchema.safeParse({
      doctorId: "doctor-1",
      weekdays: ["1", "3"],
      blocks: [
        { startTime: "09:00", endTime: "11:00", slotMinutes: "60" },
        { startTime: "11:00", endTime: "11:30", slotMinutes: "30" }
      ],
      isActive: "on"
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      weekdays: [1, 3],
      blocks: [
        { startTime: "09:00", endTime: "11:00", slotMinutes: 60 },
        { startTime: "11:00", endTime: "11:30", slotMinutes: 30 }
      ],
      isActive: true
    });
  });

  it("rejects non-divisible, overlapping, duplicate, and repeated weekday batch input", () => {
    const result = createDoctorAvailabilityBatchSchema.safeParse({
      doctorId: "doctor-1",
      weekdays: ["1", "1"],
      blocks: [
        { startTime: "09:00", endTime: "10:45", slotMinutes: "60" },
        { startTime: "10:00", endTime: "11:00", slotMinutes: "30" },
        { startTime: "10:00", endTime: "11:00", slotMinutes: "30" }
      ],
      isActive: "true"
    });

    expect(result.success).toBe(false);
  });
});
