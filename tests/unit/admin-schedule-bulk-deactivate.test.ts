import { describe, expect, it } from "vitest";
import { getDoctorScheduleDeactivateConflict } from "@/features/admin/schedules/bulk-deactivate";

describe("bulk doctor schedule deactivation safety", () => {
  it("allows deactivation only when there are no affected operational records", () => {
    expect(getDoctorScheduleDeactivateConflict({ targetDoctors: 2, activeRecurringAvailability: 24, futureDateOverrides: 3 })).toBeNull();
  });

  it("fails closed only when no active approved doctor is available", () => {
    const input = { targetDoctors: 0, activeRecurringAvailability: 0, futureDateOverrides: 0 };
    const message = "ไม่พบแพทย์";
    expect(getDoctorScheduleDeactivateConflict(input)).toContain(message);
  });
});
