import { describe, expect, it, vi } from "vitest";
import {
  applyConsultationPaymentVerification,
  assertConsultationReadyForPaymentVerification,
  getConsultationPaymentVerificationTransition,
  type ConsultationPaymentSnapshot
} from "@/features/consultations/payment/service";
import {
  DuplicatePaymentTransactionError,
  PaymentVerificationConflictError,
  ProviderVerificationUnavailableError
} from "@/features/payments/service";
import type { SlipVerificationResult } from "@/lib/payments/slip-verification";

function consultation(overrides: Partial<ConsultationPaymentSnapshot> = {}): ConsultationPaymentSnapshot {
  return {
    id: "consultation-1",
    patientId: "patient-1",
    status: "pending_payment",
    ...overrides
  };
}

function result(overrides: Partial<SlipVerificationResult> = {}): SlipVerificationResult {
  return {
    ok: true,
    provider: "easyslip",
    status: "verified",
    transRef: "transfer-1",
    amount: 900,
    receiverName: "Clinic",
    raw: {
      sensitiveQrPayload: "must-not-persist"
    },
    ...overrides
  };
}

function txMock() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "consultation-1" }]),
    auditLog: {
      create: vi.fn()
    },
    consultation: {
      findUnique: vi.fn().mockResolvedValue({
        patientId: "patient-1",
        status: "pending_payment"
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    notification: {
      create: vi.fn()
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: "payment-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
}

describe("consultation payment verification service", () => {
  it("maps verified slip checks to scheduled consultations", () => {
    expect(getConsultationPaymentVerificationTransition(true)).toEqual({
      auditAction: "consultation.payment_verified",
      nextStatus: "scheduled",
      shouldNotifyPatient: true
    });
  });

  it("maps rejected slip checks to audit-only rejection handling", () => {
    expect(getConsultationPaymentVerificationTransition(false)).toEqual({
      auditAction: "consultation.payment_rejected",
      nextStatus: null,
      shouldNotifyPatient: false
    });
  });

  it("allows only pending payment consultations to be verified", () => {
    expect(() => assertConsultationReadyForPaymentVerification("pending_payment")).not.toThrow();
  });

  it.each(["requested", "scheduled", "live", "completed", "cancelled"] as const)(
    "blocks verification for %s consultations",
    (status) => {
      expect(() => assertConsultationReadyForPaymentVerification(status)).toThrow(
        "Consultation is not ready for payment verification."
      );
    }
  );

  it("serializes, normalizes, schedules, and notifies for verified consultation payments", async () => {
    const tx = txMock();

    await applyConsultationPaymentVerification(tx as never, {
      actorId: "patient-1",
      consultation: consultation(),
      evidence: {
        amount: 900,
        qrPayload: "qr-payload"
      },
      result: result()
    });

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.consultation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "consultation-1",
        status: "pending_payment"
      },
      data: {
        status: "scheduled"
      }
    });
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consultationId: "consultation-1",
          amount: 900,
          status: "verified",
          qrPayload: "qr-payload",
          normalizedTransactionReference: "TRANSFER1",
          verificationPayload: expect.objectContaining({
            result: expect.not.objectContaining({ raw: expect.anything() })
          })
        })
      })
    );
    expect(JSON.stringify(tx.payment.create.mock.calls[0][0])).not.toContain("must-not-persist");
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "patient-1",
          type: "consultation",
          metadataJson: {
            consultationId: "consultation-1",
            href: "/consult/appointments/consultation-1"
          }
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "consultation.payment_verified",
          entityType: "consultation",
          entityId: "consultation-1",
          metadataJson: expect.objectContaining({
            transactionReferenceRecorded: true,
            amountMatched: true,
            receiverMatched: true
          })
        })
      })
    );
  });

  it("keeps pending consultations unchanged when provider rejects the slip", async () => {
    const tx = txMock();

    await applyConsultationPaymentVerification(tx as never, {
      actorId: "patient-1",
      consultation: consultation(),
      evidence: {
        amount: 900,
        qrPayload: "qr-payload"
      },
      result: result({
        ok: false,
        status: "rejected",
        transRef: null
      })
    });

    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "rejected",
          normalizedTransactionReference: null
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "consultation.payment_rejected",
          entityType: "consultation",
          entityId: "consultation-1"
        })
      })
    );
  });

  it("does not persist payment, consultation, notification, or audit changes for a provider outage", async () => {
    const tx = txMock();

    await expect(
      applyConsultationPaymentVerification(tx as never, {
        actorId: "patient-1",
        consultation: consultation(),
        evidence: { amount: 900, qrPayload: "qr-payload" },
        result: result({ ok: false, status: "provider_error", transRef: null })
      })
    ).rejects.toBeInstanceOf(ProviderVerificationUnavailableError);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("fails closed before side effects when another payment already owns the normalized reference", async () => {
    const tx = txMock();
    tx.payment.findFirst.mockResolvedValueOnce({ id: "payment-2" });

    await expect(
      applyConsultationPaymentVerification(tx as never, {
        actorId: "patient-1",
        consultation: consultation(),
        evidence: { amount: 900, qrPayload: "qr-payload" },
        result: result()
      })
    ).rejects.toBeInstanceOf(DuplicatePaymentTransactionError);

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("blocks a concurrent completed consultation payment before duplicate scheduling or side effects", async () => {
    const tx = txMock();
    tx.payment.findUnique.mockResolvedValueOnce({
      id: "payment-1",
      status: "verified",
      updatedAt: new Date("2026-08-09T08:00:00.000Z")
    });

    await expect(
      applyConsultationPaymentVerification(tx as never, {
        actorId: "patient-1",
        consultation: consultation(),
        evidence: { amount: 900, qrPayload: "qr-payload" },
        result: result()
      })
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.consultation.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
