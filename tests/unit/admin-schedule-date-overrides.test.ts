import { describe, expect, it } from "vitest";
import { createDoctorAvailabilityDateOverrideSchema } from "@/features/admin/schedules/schema";
import { getBangkokDayRange, hasOverlappingTimeBlock, parseScheduleDate } from "@/features/admin/schedules/date-overrides";

describe("admin date schedule overrides", () => {
  it("accepts a complete special opening and a full-day closure", () => {
    expect(createDoctorAvailabilityDateOverrideSchema.safeParse({ doctorId: "doctor-1", scheduleDate: "2026-08-10", type: "available", startTime: "09:00", endTime: "11:00", slotMinutes: "60" }).success).toBe(true);
    expect(createDoctorAvailabilityDateOverrideSchema.safeParse({ doctorId: "doctor-1", scheduleDate: "2026-08-10", type: "closed" }).success).toBe(true);
  });

  it("rejects an invalid special opening and detects an overlapping block", () => {
    expect(createDoctorAvailabilityDateOverrideSchema.safeParse({ doctorId: "doctor-1", scheduleDate: "2026-08-10", type: "available", startTime: "10:00", endTime: "11:00", slotMinutes: "45" }).success).toBe(false);
    expect(hasOverlappingTimeBlock([{ startTime: "09:00", endTime: "11:00", slotMinutes: 60 }], { startTime: "10:30", endTime: "11:30", slotMinutes: 30 })).toBe(true);
    expect(parseScheduleDate("2026-08-10").toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });

  it("uses the full Bangkok calendar date when checking booked appointments", () => {
    const { start, end } = getBangkokDayRange(parseScheduleDate("2026-08-10"));
    expect(start.toISOString()).toBe("2026-08-09T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-10T17:00:00.000Z");
  });
});
