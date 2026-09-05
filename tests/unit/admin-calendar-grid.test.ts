import { describe, expect, it } from "vitest";
import { buildAdminCalendarTimeRows, getSuggestedCalendarEndTime } from "@/features/admin/schedules/calendar-grid";

describe("admin calendar grid", () => {
  it("provides the standard 09:00-22:00 rows when a selected doctor has no schedule", () => {
    const rows = buildAdminCalendarTimeRows([]);

    expect(rows).toHaveLength(26);
    expect(rows[0]).toBe("09:00");
    expect(rows.at(-1)).toBe("21:30");
  });

  it("keeps configured slot rows and preselects one supported interval from a clicked fallback cell", () => {
    expect(buildAdminCalendarTimeRows(["10:00", "09:00", "10:00"])).toEqual(["09:00", "10:00"]);
    expect(getSuggestedCalendarEndTime("21:30")).toBe("22:00");
  });
});
