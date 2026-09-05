import { describe, expect, it } from "vitest";
import { moveCalendarDate } from "@/features/admin/schedules/calendar-navigation";

describe("admin calendar navigation", () => {
  it("moves the month view to the following calendar month", () => {
    expect(moveCalendarDate("2026-09-01", "month", 1)).toBe("2026-10-01");
    expect(moveCalendarDate("2026-01-31", "month", 1)).toBe("2026-02-01");
  });

  it("moves the month view to the previous calendar month", () => {
    expect(moveCalendarDate("2026-09-01", "month", -1)).toBe("2026-08-01");
  });

  it("keeps day and week navigation at their existing intervals", () => {
    expect(moveCalendarDate("2026-09-01", "day", 1)).toBe("2026-09-02");
    expect(moveCalendarDate("2026-09-01", "week", 1)).toBe("2026-09-08");
  });
});
