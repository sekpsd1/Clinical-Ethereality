import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("15-minute consultation authoring UI", () => {
  it("does not render a duration selector on recurring, bulk, or daily Admin schedule forms", () => {
    const sources = [
      "features/admin/AdminScheduleForm.tsx",
      "features/admin/AdminBulkScheduleEditor.tsx",
      "features/admin/AdminDateScheduleEditor.tsx"
    ].map(readSource);

    for (const source of sources) {
      expect(source).not.toContain("CONSULTATION_DURATION_OPTIONS.map");
      expect(source).toContain("กำหนดตายตัว");
    }
  });

  it("renders the fixed duration instead of trusting a slot duration label from props", () => {
    const bookingForm = readSource("features/consultations/booking/BookingTimeSlotForm.tsx");

    expect(bookingForm).toContain("{NEW_CONSULTATION_DURATION_MINUTES} นาที");
    expect(bookingForm).not.toContain("{slot.slotMinutes} นาที");
  });
});
