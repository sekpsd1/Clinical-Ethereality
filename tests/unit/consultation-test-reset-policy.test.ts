import { describe, expect, it } from "vitest";
import {
  getConsultationTestResetMarker,
  isControlledTestConsultation,
  isScheduleBlockingPendingConsultationPayment
} from "@/features/admin/consultation-test-reset/policy";

const cancelledAt = "2026-09-05T10:00:00.000Z";
const validMarker = {
  version: 1,
  kind: "test_data_reset",
  reason: "test_data_reset",
  consultationId: "consultation-1",
  paymentId: "payment-1",
  cancelledAt,
  cancelledById: "admin-1",
  previousConsultationStatus: "pending_payment",
  paymentStatusAtReset: "pending_review"
};

describe("consultation test reset policy", () => {
  it("requires the controlled non-monetary UAT summary and matching source audit", () => {
    const summary =
      "[UAT] Controlled non-monetary Zoom UAT; key=fixture-20260905";
    const audit = {
      controlled: true,
      fixtureKey: "fixture-20260905",
      nonMonetary: true,
      targetFingerprint: "opaque-fingerprint"
    };

    expect(isControlledTestConsultation(summary, audit)).toBe(true);
    expect(isControlledTestConsultation(summary, { ...audit, nonMonetary: false })).toBe(false);
    expect(isControlledTestConsultation("customer said this is a test", audit)).toBe(false);
  });

  it("parses only the strict reset marker contract", () => {
    expect(getConsultationTestResetMarker({ testDataReset: validMarker })).toEqual(validMarker);
    expect(
      getConsultationTestResetMarker({
        testDataReset: { ...validMarker, reason: "admin_note" }
      })
    ).toBeNull();
    expect(
      getConsultationTestResetMarker({
        testDataReset: { ...validMarker, cancelledAt: "not-a-date" }
      })
    ).toBeNull();
  });

  it("lets schedule preflight ignore only a matching marked pending payment on a cancelled consultation", () => {
    expect(
      isScheduleBlockingPendingConsultationPayment({
        consultationId: "consultation-1",
        consultationStatus: "cancelled",
        paymentId: "payment-1",
        paymentStatus: "pending_review",
        verificationPayload: { testDataReset: validMarker }
      })
    ).toBe(false);

    for (const changed of [
      { consultationStatus: "pending_payment" as const },
      { consultationId: "consultation-other" },
      { paymentId: "payment-other" },
      { verificationPayload: null }
    ]) {
      expect(
        isScheduleBlockingPendingConsultationPayment({
          consultationId: "consultation-1",
          consultationStatus: "cancelled",
          paymentId: "payment-1",
          paymentStatus: "pending_review",
          verificationPayload: { testDataReset: validMarker },
          ...changed
        })
      ).toBe(true);
    }
  });

  it("does not treat non-pending payment statuses as schedule blockers", () => {
    expect(
      isScheduleBlockingPendingConsultationPayment({
        consultationId: "consultation-1",
        consultationStatus: "scheduled",
        paymentId: "payment-1",
        paymentStatus: "verified",
        verificationPayload: null
      })
    ).toBe(false);
  });
});
