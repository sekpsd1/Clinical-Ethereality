import { describe, expect, it } from "vitest";
import {
  assertPaymentReadyForManualReview,
  assertPaymentReadyForProviderVerification,
  getManualPaymentReviewTransition,
  getProviderPaymentVerificationTransition,
  getProviderSlipAttachmentCreateData
} from "@/features/payments/service";
import type { NormalizedHostedAttachment } from "@/lib/storage/attachments";

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

  it("maps verified provider checks to paid orders", () => {
    expect(getProviderPaymentVerificationTransition(true)).toMatchObject({
      paymentStatus: "verified",
      orderStatus: "paid",
      notificationTitle: "ตรวจสอบสลิปสำเร็จ"
    });
  });

  it("maps rejected provider checks back to pending payment", () => {
    expect(getProviderPaymentVerificationTransition(false)).toMatchObject({
      paymentStatus: "rejected",
      orderStatus: "pending_payment",
      notificationTitle: "ตรวจสอบสลิปไม่ผ่าน"
    });
  });

  it.each(["pending_review", "pending_slip"] as const)("allows provider verification for %s payments", (status) => {
    expect(() => assertPaymentReadyForProviderVerification(status)).not.toThrow();
  });

  it.each(["verified", "rejected", "refunded"] as const)("blocks provider verification for %s payments", (status) => {
    expect(() => assertPaymentReadyForProviderVerification(status)).toThrow("Payment is not ready for slip verification.");
  });

  it("creates payment slip attachment metadata only when a hosted slip URL exists", () => {
    const hostedSlipAttachment: NormalizedHostedAttachment = {
      storageUrl: "https://cdn.example.com/slips/payment-1.png",
      storageKey: "slips/payment-1.png",
      fileName: "payment-1.png",
      mimeType: "image/png",
      byteSize: 12345,
      storageProvider: "s3",
      storageConfigured: true
    };

    expect(
      getProviderSlipAttachmentCreateData({
        hostedSlipAttachment: null,
        orderId: "order-1",
        ownerId: "user-1",
        paymentId: "payment-1"
      })
    ).toBeNull();
    expect(
      getProviderSlipAttachmentCreateData({
        hostedSlipAttachment,
        orderId: "order-1",
        ownerId: "user-1",
        paymentId: "payment-1"
      })
    ).toMatchObject({
      ownerId: "user-1",
      purpose: "payment_slip",
      entityType: "payment",
      entityId: "payment-1",
      storageUrl: "https://cdn.example.com/slips/payment-1.png",
      storageKey: "slips/payment-1.png",
      fileName: "payment-1.png",
      metadataJson: {
        orderId: "order-1",
        source: "payment_slip_verification",
        storageProvider: "s3",
        storageConfigured: true
      }
    });
  });
});
