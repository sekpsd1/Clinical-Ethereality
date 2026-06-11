import { describe, expect, it } from "vitest";
import { assertPaymentReadyForManualReview, getManualPaymentReviewTransition } from "@/features/payments/service";

describe("payment review service", () => {
  it("maps verified manual reviews to order preparation", () => {
    expect(getManualPaymentReviewTransition("verified")).toMatchObject({
      paymentStatus: "verified",
      orderStatus: "preparing",
      notificationTitle: "ยืนยันการชำระเงินแล้ว"
    });
  });

  it("maps rejected manual reviews back to pending payment", () => {
    expect(getManualPaymentReviewTransition("rejected")).toMatchObject({
      paymentStatus: "rejected",
      orderStatus: "pending_payment",
      notificationTitle: "สลิปไม่ผ่านการตรวจสอบ"
    });
  });

  it("allows only pending review payments to be manually reviewed", () => {
    expect(() => assertPaymentReadyForManualReview("pending_review")).not.toThrow();
  });

  it.each(["pending_slip", "verified", "rejected", "refunded"] as const)("blocks manual review for %s payments", (status) => {
    expect(() => assertPaymentReadyForManualReview(status)).toThrow("Payment has already been reviewed.");
  });
});
