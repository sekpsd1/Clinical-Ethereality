import { describe, expect, it } from "vitest";
import { getBookingSources } from "@/features/consultations/booking/queries";
import { getBangkokCalendarDateKey, getScheduledAtForDate, getScheduledSlotTimes } from "@/features/consultations/booking/slots";

describe("consultation booking slots", () => {
  it("expands a 15-minute availability into four consultation slots per hour", () => {
    const scheduledAt = getScheduledAtForDate(new Date("2026-08-03T00:00:00.000Z"), "09:00");
    const slots = getScheduledSlotTimes(scheduledAt, "09:00", "10:00", 15);

    expect(slots.map((slot) => slot.toISOString())).toEqual([
      "2026-08-03T02:00:00.000Z",
      "2026-08-03T02:15:00.000Z",
      "2026-08-03T02:30:00.000Z",
      "2026-08-03T02:45:00.000Z"
    ]);
  });

  it.each([30, 45, 60, 20])("canonicalizes a persisted %i-minute schedule into adjacent 15-minute slots", (persistedMinutes) => {
    const scheduledAt = getScheduledAtForDate(new Date("2026-08-03T00:00:00.000Z"), "09:00");
    const slots = getScheduledSlotTimes(scheduledAt, "09:00", "10:00", persistedMinutes);

    expect(slots.map((slot) => slot.toISOString())).toEqual([
      "2026-08-03T02:00:00.000Z",
      "2026-08-03T02:15:00.000Z",
      "2026-08-03T02:30:00.000Z",
      "2026-08-03T02:45:00.000Z"
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
      "09:15",
      "09:30",
      "09:45",
      "10:00",
      "10:15",
      "10:30",
      "10:45",
      "11:00",
      "11:15"
    ]);
    expect(getBookingSources(recurring as never, [...opening, ...duplicate] as never, now).every((slot) => slot.slotMinutes === 15)).toBe(true);
    expect(getBookingSources(recurring as never, closed as never, now)).toEqual([]);
  });

  it("shows only remaining slots for a recurring availability on the current Bangkok day", () => {
    const recurring = [{ id: "websthai-saturday", weekday: 6, startTime: "09:00", endTime: "22:00", slotMinutes: 60, notes: null }];
    const now = new Date("2026-09-05T15:00:00.000+07:00");

    const slots = getBookingSources(recurring as never, [] as never, now);

    expect(slots[0]).toMatchObject({ startTime: "15:15", slotMinutes: 15 });
    expect(slots.at(-1)).toMatchObject({ startTime: "21:45", slotMinutes: 15 });
    expect(slots.every((slot) => getBangkokCalendarDateKey(slot.scheduledAt) === "2026-09-05")).toBe(true);
    expect(slots.every((slot, index) => index === 0 || slot.scheduledAt.getTime() - slots[index - 1].scheduledAt.getTime() === 15 * 60_000)).toBe(true);
  });

  it("omits every customer slot that overlaps an active blocked date range", () => {
    const recurring = [{ id: "weekly", weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 30, notes: null }];
    const blocked = [{ id: "blocked", type: "blocked", scheduleDate: new Date("2026-08-03T00:00:00.000Z"), startTime: "09:30", endTime: "10:30", slotMinutes: 30, notes: null }];
    const slots = getBookingSources(recurring as never, blocked as never, new Date("2026-08-01T02:00:00.000Z"));

    expect(slots.map((slot) => slot.startTime)).toEqual(["09:00", "09:15", "10:30", "10:45"]);
  });
});
