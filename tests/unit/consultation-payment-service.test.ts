import { describe, expect, it, vi } from "vitest";
import {
  applyConsultationPaymentVerification,
  assertConsultationReadyForPaymentVerification,
  getConsultationPaymentVerificationTransition,
  type ConsultationPaymentSnapshot
} from "@/features/consultations/payment/service";
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
      ok: true
    },
    ...overrides
  };
}

function txMock() {
  return {
    auditLog: {
      create: vi.fn()
    },
    consultation: {
      update: vi.fn()
    },
    notification: {
      create: vi.fn()
    },
    payment: {
      upsert: vi.fn()
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

  it("schedules and notifies patients for verified consultation payments", async () => {
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

    expect(tx.consultation.update).toHaveBeenCalledWith({
      where: {
        id: "consultation-1"
      },
      data: {
        status: "scheduled"
      }
    });
    expect(tx.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          consultationId: "consultation-1"
        },
        create: expect.objectContaining({
          consultationId: "consultation-1",
          amount: 900,
          status: "verified",
          qrPayload: "qr-payload"
        })
      })
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "patient-1",
          type: "consultation",
          metadataJson: expect.objectContaining({
            consultationId: "consultation-1",
            provider: "easyslip",
            transRef: "transfer-1"
          })
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "consultation.payment_verified",
          entityType: "consultation",
          entityId: "consultation-1"
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

    expect(tx.consultation.update).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: "rejected"
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
});
