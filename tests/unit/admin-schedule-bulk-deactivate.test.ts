import { describe, expect, it } from "vitest";
import { getDoctorScheduleDeactivateConflict, isCancelledTestResetPayment } from "@/features/admin/schedules/bulk-deactivate";

describe("bulk doctor schedule deactivation safety", () => {
  it("allows deactivation only when there are no affected operational records", () => {
    expect(getDoctorScheduleDeactivateConflict({ targetDoctors: 2, activeConsultations: 0, pendingPayments: 0, activeSlotLocks: 0 })).toBeNull();
  });

  it("excludes only a strictly marked cancelled test-reset payment", () => {
    const base = {
      id: "payment-1",
      consultation: { id: "consultation-1", status: "cancelled" },
      verificationPayload: { testDataReset: { version: 1, kind: "test_data_reset", reason: "test_data_reset", consultationId: "consultation-1", paymentId: "payment-1", cancelledAt: "2026-09-05T12:00:00.000Z", cancelledById: "admin-1", previousConsultationStatus: "pending_payment", paymentStatusAtReset: "pending_review" } }
    };
    expect(isCancelledTestResetPayment(base)).toBe(true);
    expect(isCancelledTestResetPayment({ ...base, consultation: { ...base.consultation, status: "pending_payment" } })).toBe(false);
    expect(isCancelledTestResetPayment({ ...base, verificationPayload: { testDataReset: { ...base.verificationPayload.testDataReset, paymentId: "other-payment" } } })).toBe(false);
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
