import { describe, expect, it } from "vitest";
import { getSlotTimestamp, getUpcomingDateForWeekday, LOCKING_CONSULTATION_STATUSES } from "@/features/consultations/booking/slots";

describe("booking slot helpers", () => {
  it("calculates the next upcoming weekday slot without using the current day", () => {
    const now = new Date("2026-06-10T08:00:00.000+07:00"); // Wednesday
    const scheduledAt = getUpcomingDateForWeekday(3, "17:00", now);

    expect(scheduledAt.toISOString()).toBe("2026-06-17T10:00:00.000Z");
  });

  it("locks only active consultation states that reserve a doctor slot", () => {
    expect(LOCKING_CONSULTATION_STATUSES).toEqual(["pending_payment", "scheduled", "live"]);
  });

  it("normalizes date instances to stable timestamps for slot lock sets", () => {
    expect(getSlotTimestamp(new Date("2026-06-15T10:00:00.000Z"))).toBe(
      new Date("2026-06-15T10:00:00.000Z").getTime()
    );
  });
});
