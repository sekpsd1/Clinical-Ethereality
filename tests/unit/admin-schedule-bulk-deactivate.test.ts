import { describe, expect, it } from "vitest";
import { getDoctorScheduleDeactivateConflict } from "@/features/admin/schedules/bulk-deactivate";

describe("bulk doctor schedule deactivation safety", () => {
  it("allows deactivation only when there are no affected operational records", () => {
    expect(getDoctorScheduleDeactivateConflict({ targetDoctors: 2, activeConsultations: 0, pendingPayments: 0, activeSlotLocks: 0 })).toBeNull();
  });

  it.each([
    [{ targetDoctors: 2, activeConsultations: 1, pendingPayments: 0, activeSlotLocks: 0 }, "นัดหมาย"],
    [{ targetDoctors: 2, activeConsultations: 0, pendingPayments: 1, activeSlotLocks: 0 }, "ชำระเงิน"],
    [{ targetDoctors: 2, activeConsultations: 0, pendingPayments: 0, activeSlotLocks: 1 }, "ล็อก"],
    [{ targetDoctors: 0, activeConsultations: 0, pendingPayments: 0, activeSlotLocks: 0 }, "ไม่พบแพทย์"]
  ])("fails closed for %o", (input, message) => {
    expect(getDoctorScheduleDeactivateConflict(input)).toContain(message);
  });
});
