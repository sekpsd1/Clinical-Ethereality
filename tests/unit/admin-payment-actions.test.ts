import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  applyManualAppointmentPaymentDecision: vi.fn(),
  applyManualConsultationPaymentReview: vi.fn(),
  applyManualPaymentReview: vi.fn(),
  applyManualStoreRefund: vi.fn(),
  assertPermission: vi.fn(),
  consultationFindFirst: vi.fn(),
  createManualAppointmentPaymentIntake: vi.fn(),
  getManualStoreRefundReadiness: vi.fn(),
  preparePrivatePaymentSlip: vi.fn(),
  releaseExpiredConsultationSlotLocks: vi.fn(),
  requireAdminSession: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    consultation: { findFirst: mocks.consultationFindFirst },
    user: { findUnique: mocks.userFindUnique }
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
  applyManualAppointmentPaymentDecision: mocks.applyManualAppointmentPaymentDecision,
  applyManualConsultationPaymentReview: mocks.applyManualConsultationPaymentReview,
  createManualAppointmentPaymentIntake: mocks.createManualAppointmentPaymentIntake,
  getManualAppointmentIntake: vi.fn(),
  consultationManualReviewReasonCodes: [
    "provider_unavailable",
    "provider_timeout",
    "provider_result_ambiguous"
  ],
  ConsultationManualReviewError: class ConsultationManualReviewError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  },
  manualAppointmentRejectionReasonCodes: [
    "bank_transfer_not_found",
    "amount_mismatch",
    "evidence_invalid",
    "duplicate_transaction_reference"
  ],
  ManualAppointmentIntakeError: class ManualAppointmentIntakeError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
}));

vi.mock("@/features/payments/private-slips", () => ({
  getPaymentSlipErrorMessage: vi.fn(() => "invalid slip"),
  preparePrivatePaymentSlip: mocks.preparePrivatePaymentSlip
}));

vi.mock("@/features/consultations/booking/lock-release", () => ({
  releaseExpiredConsultationSlotLocks: mocks.releaseExpiredConsultationSlotLocks
}));

import {
  createManualAppointmentPaymentIntakeAction,
  refundStorePaymentAction,
  reviewManualAppointmentPaymentAction,
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
    mocks.userFindUnique.mockResolvedValue({
      role: "customer",
      status: "active",
      fullName: "Verified Patient",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      phone: "0812345678",
      normalizedPhone: "+66812345678",
      phoneVerifiedAt: new Date("2026-09-01T00:00:00.000Z")
    });
    mocks.preparePrivatePaymentSlip.mockResolvedValue({
      attachmentId: "attachment-1",
      byteSize: 128,
      cleanup: vi.fn(),
      fileName: "slip.png",
      mimeType: "image/png",
      storageKey: "payments/private/slip.png",
      storageUrl: "/api/payments/slips/attachment-1"
    });
    mocks.releaseExpiredConsultationSlotLocks.mockResolvedValue({
      releasedLocks: 0,
      cancelledConsultations: 0
    });
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

  it("creates a manual appointment intake only through its dedicated permission and serializable service", async () => {
    mocks.createManualAppointmentPaymentIntake.mockResolvedValueOnce({
      consultationId: "consultation-1",
      paymentId: "payment-1",
      status: "created"
    });
    const formData = new FormData();
    formData.set("patientId", "cm0patient0000000000000001");
    formData.set("doctorId", "cm0doctor00000000000000001");
    formData.set("availabilityId", "availability-1");
    formData.set("scheduledAt", "2026-09-07T02:00:00.000Z");
    formData.set("transferredAt", "2026-09-05T12:30");
    formData.set("reasonCode", "provider_unavailable");
    formData.set("confirmedManualIntake", "true");
    formData.set(
      "evidence",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "slip.png", {
        type: "image/png"
      })
    );

    const result = await createManualAppointmentPaymentIntakeAction(
      { status: "idle", message: "" },
      formData
    );

    expect(result).toMatchObject({
      status: "success",
      consultationId: "consultation-1",
      paymentId: "payment-1"
    });
    expect(mocks.assertPermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1" }),
      "consultation:manual-create"
    );
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.createManualAppointmentPaymentIntake).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "admin-1",
        patientId: "cm0patient0000000000000001",
        doctorId: "cm0doctor00000000000000001"
      })
    );
  });

  it("does not persist evidence when the manual-create permission is denied", async () => {
    mocks.assertPermission.mockImplementationOnce(() => {
      throw new Error("Permission required.");
    });
    const formData = new FormData();

    await expect(
      createManualAppointmentPaymentIntakeAction(
        { status: "idle", message: "" },
        formData
      )
    ).rejects.toThrow("Permission required.");

    expect(mocks.preparePrivatePaymentSlip).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("uses the existing manual-review permission for an Admin appointment decision", async () => {
    mocks.applyManualAppointmentPaymentDecision.mockResolvedValueOnce("scheduled");
    const formData = new FormData();
    formData.set("paymentId", "payment-1");
    formData.set("decision", "verified");
    formData.set("transactionReference", "bank-reference-1");
    formData.set("confirmedExternalBankCheck", "true");

    const result = await reviewManualAppointmentPaymentAction(
      { status: "idle", message: "" },
      formData
    );

    expect(result).toMatchObject({ status: "success" });
    expect(mocks.assertPermission).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1" }),
      "consultation-payment:manual-review"
    );
    expect(mocks.applyManualAppointmentPaymentDecision).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorId: "admin-1",
        decision: "verified",
        paymentId: "payment-1",
        transactionReference: "BANKREFERENCE1"
      }
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
