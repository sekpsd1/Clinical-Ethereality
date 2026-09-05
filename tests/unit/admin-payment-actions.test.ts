import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  applyManualConsultationPaymentReview: vi.fn(),
  applyManualPaymentReview: vi.fn(),
  applyManualStoreRefund: vi.fn(),
  assertPermission: vi.fn(),
  getManualStoreRefundReadiness: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminSession: mocks.requireAdminSession
}));

vi.mock("@/lib/permissions", () => ({
  assertPermission: mocks.assertPermission
}));

vi.mock("@/features/payments/service", () => ({
  applyManualPaymentReview: mocks.applyManualPaymentReview
}));

vi.mock("@/features/payments/refunds", () => ({
  applyManualStoreRefund: mocks.applyManualStoreRefund
}));

vi.mock("@/features/payments/refund-readiness", () => ({
  getManualStoreRefundReadiness: mocks.getManualStoreRefundReadiness
}));

vi.mock("@/features/consultations/payment/manual-review", () => ({
  applyManualConsultationPaymentReview: mocks.applyManualConsultationPaymentReview,
  consultationManualReviewReasonCodes: [
    "provider_unavailable",
    "provider_timeout",
    "provider_result_ambiguous"
  ],
  ConsultationManualReviewError: class ConsultationManualReviewError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
}));

import {
  refundStorePaymentAction,
  reviewConsultationPaymentAction,
  reviewPaymentAction
} from "@/features/admin/payments/actions";

describe("admin payment review action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({
      userId: "admin-1",
      role: "admin"
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => callback({}));
    mocks.getManualStoreRefundReadiness.mockResolvedValue({ status: "ready", message: "พร้อมบันทึกคืนเงิน" });
  });

  it("runs manual payment review in a serializable transaction", async () => {
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("status", "verified");
    formData.set("transactionReference", "manual-reference-1");

    const result = await reviewPaymentAction(
      {
        status: "idle",
        message: ""
      },
      formData
    );

    expect(result.status).toBe("success");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.applyManualPaymentReview).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorId: "admin-1",
        paymentId: "payment-1",
        status: "verified",
        transactionReference: "MANUALREFERENCE1"
      }
    );
  });

  it("does not start a review transaction when the existing admin guard rejects the caller", async () => {
    mocks.requireAdminSession.mockRejectedValueOnce(new Error("Admin access required."));
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("status", "verified");
    formData.set("transactionReference", "manual-reference-1");

    await expect(
      reviewPaymentAction(
        {
          status: "idle",
          message: ""
        },
        formData
      )
    ).rejects.toThrow("Admin access required.");

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.applyManualPaymentReview).not.toHaveBeenCalled();
  });

  it("requires the dedicated permission and a serializable transaction for consultation review", async () => {
    mocks.applyManualConsultationPaymentReview.mockResolvedValueOnce("scheduled");
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("amount", "900.00");
    formData.set("transactionReference", "bank-reference-1");
    formData.set("transferredAt", "2026-09-05T10:30");
    formData.set("customerReportedAt", "2026-09-05T11:30");
    formData.set("reasonCode", "provider_unavailable");
    formData.set("confirmedExternalBankCheck", "true");

    const result = await reviewConsultationPaymentAction(
      { status: "idle", message: "" },
      formData
    );

    expect(result).toMatchObject({ status: "success" });
    expect(mocks.assertPermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1" }),
      "consultation-payment:manual-review"
    );
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.applyManualConsultationPaymentReview).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "admin-1",
        amount: "900.00",
        paymentId: "payment-1",
        transactionReference: "BANKREFERENCE1"
      })
    );
  });

  it("requires the existing admin guard and serializable transaction for a manual Store refund", async () => {
    mocks.applyManualStoreRefund.mockResolvedValueOnce("refunded");
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("refundAmount", "100.00");
    formData.set("refundReason", "สินค้าไม่พร้อมจัดส่ง");
    formData.set("refundTransactionReference", "refund-reference-1");
    formData.set("confirmedExternalTransfer", "true");

    const result = await refundStorePaymentAction({ status: "idle", message: "" }, formData);

    expect(result.status).toBe("success");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.applyManualStoreRefund).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "admin-1",
        paymentId: "payment-1",
        refundAmount: "100.00"
      })
    );
  });

  it("does not start a refund transaction when the caller is not an admin", async () => {
    mocks.requireAdminSession.mockRejectedValueOnce(new Error("Admin access required."));
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("refundAmount", "100.00");
    formData.set("refundReason", "สินค้าจัดส่งไม่ได้");
    formData.set("refundTransactionReference", "refund-reference-1");
    formData.set("confirmedExternalTransfer", "true");

    await expect(refundStorePaymentAction({ status: "idle", message: "" }, formData)).rejects.toThrow(
      "Admin access required."
    );

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.applyManualStoreRefund).not.toHaveBeenCalled();
  });

  it("requires the external-transfer confirmation before a refund transaction starts", async () => {
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("refundAmount", "100.00");
    formData.set("refundReason", "สินค้าจัดส่งไม่ได้");
    formData.set("refundTransactionReference", "refund-reference-1");

    const result = await refundStorePaymentAction({ status: "idle", message: "" }, formData);

    expect(result.status).toBe("error");
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.applyManualStoreRefund).not.toHaveBeenCalled();
  });

  it("fails closed before a refund transaction when the readiness check is not ready", async () => {
    mocks.getManualStoreRefundReadiness.mockResolvedValueOnce({
      status: "not_ready",
      message: "ยังไม่พร้อมบันทึกคืนเงิน กรุณาตรวจ schema ก่อน"
    });
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("refundAmount", "100.00");
    formData.set("refundReason", "คืนเงินรายการทดสอบ UAT — ไม่จัดส่งสินค้า");
    formData.set("refundTransactionReference", "refund-reference-1");
    formData.set("confirmedExternalTransfer", "true");

    const result = await refundStorePaymentAction({ status: "idle", message: "" }, formData);

    expect(result).toEqual({
      status: "error",
      message: "ยังไม่พร้อมบันทึกคืนเงิน กรุณาตรวจ schema ก่อน"
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
