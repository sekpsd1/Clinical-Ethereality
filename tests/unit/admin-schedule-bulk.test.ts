import { describe, expect, it } from "vitest";
import { buildBatchAvailabilityRecords, findExistingAvailabilityConflict } from "@/features/admin/schedules/bulk";
import { createDoctorAvailabilityBatchSchema } from "@/features/admin/schedules/schema";

function batchInput() {
  return createDoctorAvailabilityBatchSchema.parse({
    doctorId: "doctor-1",
    weekdays: [1, 3],
    blocks: [
      { startTime: "09:00", endTime: "11:00", slotMinutes: 60 },
      { startTime: "11:00", endTime: "11:30", slotMinutes: 30 }
    ],
    isActive: "true",
    notes: "ติดตามอาการ"
  });
}

describe("admin bulk schedule helpers", () => {
  it("expands multiple days and mixed duration blocks into one availability record per day/block", () => {
    expect(buildBatchAvailabilityRecords(batchInput())).toEqual([
      expect.objectContaining({ weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 60 }),
      expect.objectContaining({ weekday: 1, startTime: "11:00", endTime: "11:30", slotMinutes: 30 }),
      expect.objectContaining({ weekday: 3, startTime: "09:00", endTime: "11:00", slotMinutes: 60 }),
      expect.objectContaining({ weekday: 3, startTime: "11:00", endTime: "11:30", slotMinutes: 30 })
    ]);
  });

  it("detects saved duplicates and saved overlaps before the batch is created", () => {
    const requested = buildBatchAvailabilityRecords(batchInput());

    expect(
      findExistingAvailabilityConflict(
        [{ weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 60 }],
        requested
      )
    ).toBe("duplicate");
    expect(
      findExistingAvailabilityConflict(
        [{ weekday: 3, startTime: "10:30", endTime: "12:00", slotMinutes: 30 }],
        requested
      )
    ).toBe("overlap");
  });
});
