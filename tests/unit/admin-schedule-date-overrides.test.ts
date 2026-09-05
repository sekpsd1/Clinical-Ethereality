import { describe, expect, it } from "vitest";
import { copyDoctorAvailabilityDateOverridesSchema, createDoctorAvailabilityDateOverrideSchema, updateDoctorAvailabilityDateOverrideSchema } from "@/features/admin/schedules/schema";
import { getBangkokDayRange, getBangkokScheduleDateValue, hasOverlappingTimeBlock, isPastScheduleDate, parseScheduleDate } from "@/features/admin/schedules/date-overrides";

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

  it("uses Bangkok calendar dates to reject past daily changes", () => {
    const now = new Date("2026-08-10T17:30:00.000Z");
    expect(getBangkokScheduleDateValue(now)).toBe("2026-08-11");
    expect(isPastScheduleDate("2026-08-10", now)).toBe(true);
    expect(isPastScheduleDate("2026-08-11", now)).toBe(false);
  });

  it("requires a distinct confirmed target list when copying a daily schedule", () => {
    expect(copyDoctorAvailabilityDateOverridesSchema.safeParse({ doctorId: "doctor-1", sourceDate: "2026-08-10", targetDates: ["2026-08-11", "2026-08-12"], confirm: "copy" }).success).toBe(true);
    expect(copyDoctorAvailabilityDateOverridesSchema.safeParse({ doctorId: "doctor-1", sourceDate: "2026-08-10", targetDates: ["2026-08-10"], confirm: "copy" }).success).toBe(false);
    expect(updateDoctorAvailabilityDateOverrideSchema.safeParse({ overrideId: "override-1", doctorId: "doctor-1", scheduleDate: "2026-08-10", type: "available", startTime: "09:00", endTime: "10:00", slotMinutes: 30 }).success).toBe(true);
  });
});
