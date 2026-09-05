import { describe, expect, it } from "vitest";
import { getBookingSources } from "@/features/consultations/booking/queries";
import { getBangkokCalendarDateKey, getScheduledAtForDate, getScheduledSlotTimes } from "@/features/consultations/booking/slots";

describe("consultation booking slots", () => {
  it("expands a schedule range into bookable Bangkok-time slots", () => {
    const scheduledAt = getScheduledAtForDate(new Date("2026-08-03T00:00:00.000Z"), "09:00");
    const slots = getScheduledSlotTimes(scheduledAt, "09:00", "11:00", 60);

    expect(slots.map((slot) => slot.toISOString())).toEqual([
      "2026-08-03T02:00:00.000Z",
      "2026-08-03T03:00:00.000Z"
    ]);
    expect(getBangkokCalendarDateKey(slots[0])).toBe("2026-08-03");
  });

  it("adds date-specific openings, removes duplicates, and lets a closure suppress the recurring schedule", () => {
    const recurring = [{ id: "weekly", weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 60, notes: null }];
    const opening = [{ id: "special", type: "available", scheduleDate: new Date("2026-08-03T00:00:00.000Z"), startTime: "11:00", endTime: "11:30", slotMinutes: 30, notes: null }];
    const duplicate = [{ id: "legacy-special", type: "available", scheduleDate: new Date("2026-08-03T00:00:00.000Z"), startTime: "10:00", endTime: "11:00", slotMinutes: 60, notes: null }];
    const closed = [{ id: "closed", type: "closed", scheduleDate: new Date("2026-08-03T00:00:00.000Z"), startTime: null, endTime: null, slotMinutes: null, notes: null }];
    const now = new Date("2026-08-01T02:00:00.000Z");

    expect(getBookingSources(recurring as never, [...opening, ...duplicate] as never, now).map((slot) => slot.startTime)).toEqual([
      "09:00",
      "10:00",
      "11:00"
    ]);
    expect(getBookingSources(recurring as never, closed as never, now)).toEqual([]);
  });

  it("shows only remaining slots for a recurring availability on the current Bangkok day", () => {
    const recurring = [{ id: "websthai-saturday", weekday: 6, startTime: "09:00", endTime: "22:00", slotMinutes: 60, notes: null }];
    const now = new Date("2026-09-05T15:00:00.000+07:00");

    const slots = getBookingSources(recurring as never, [] as never, now);

    expect(slots.map((slot) => [getBangkokCalendarDateKey(slot.scheduledAt), slot.startTime])).toEqual([
      ["2026-09-05", "16:00"],
      ["2026-09-05", "17:00"],
      ["2026-09-05", "18:00"],
      ["2026-09-05", "19:00"],
      ["2026-09-05", "20:00"],
      ["2026-09-05", "21:00"]
    ]);
  });
});
