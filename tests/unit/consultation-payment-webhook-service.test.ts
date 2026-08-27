import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyConsultationPaymentVerification: vi.fn()
}));

vi.mock("@/features/consultations/payment/service", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/features/consultations/payment/service")
  >();

  return {
    ...original,
    applyConsultationPaymentVerification: mocks.applyConsultationPaymentVerification
  };
});

import {
  ConsultationPaymentWebhookNotActionableError,
  ConsultationPaymentWebhookValidationError,
  persistConsultationPaymentWebhookEvent
} from "@/features/consultations/payment/webhook-service";
import { PaymentVerificationConflictError } from "@/features/payments/service";
import type { ActionableConsultationPaymentWebhookEvent } from "@/features/consultations/payment/webhook-schema";

const verifiedEvent: ActionableConsultationPaymentWebhookEvent = {
  eventId: "evt-verified-1",
  eventType: "consultation.payment.verified",
  provider: "slipok",
  paymentId: "payment-1",
  amount: 900,
  receiverVerified: true,
  transactionReference: "transfer-1"
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment-1",
    amount: new Prisma.Decimal(900),
    status: "pending_review",
    normalizedTransactionReference: null,
    updatedAt: new Date("2026-08-27T08:00:00.000Z"),
    verificationPayload: {
      source: "consultation_private_slip"
    },
    consultation: {
      id: "consultation-1",
      patientId: "patient-1",
      status: "pending_payment"
    },
    ...overrides
  };
}

function txMock(currentPayment = payment()) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "locked" }]),
    payment: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ consultationId: "consultation-1" })
        .mockResolvedValueOnce(currentPayment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
}

describe("consultation payment webhook persistence service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyConsultationPaymentVerification.mockResolvedValue(undefined);
  });

  it("claims minimal event metadata under the locks before applying a verified transition", async () => {
    const tx = txMock();

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).resolves.toBe("processed");

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.payment.updateMany).toHaveBeenCalledWith({
      where: {
        id: "payment-1",
        status: "pending_review",
        updatedAt: new Date("2026-08-27T08:00:00.000Z")
      },
      data: {
        verificationPayload: {
          source: "consultation_private_slip",
          providerWebhook: {
            eventId: "evt-verified-1",
            outcome: "verified",
            provider: "slipok"
          }
        }
      }
    });
    expect(JSON.stringify(tx.payment.updateMany.mock.calls[0][0])).not.toContain("transactionReference");
    expect(mocks.applyConsultationPaymentVerification).toHaveBeenCalledWith(tx, {
      actorId: null,
      consultation: {
        id: "consultation-1",
        patientId: "patient-1",
        status: "pending_payment"
      },
      evidence: {
        amount: 900,
        source: "provider_webhook"
      },
      result: {
        ok: true,
        provider: "slipok",
        status: "verified",
        transRef: "transfer-1",
        amount: 900,
        receiverName: null,
        transactionTimestamp: null,
        raw: null
      }
    });
    expect(tx.payment.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.applyConsultationPaymentVerification.mock.invocationCallOrder[0]
    );
  });

  it("applies a new rejected event without fabricating a transaction reference or actor", async () => {
    const tx = txMock();
    const rejectedEvent: ActionableConsultationPaymentWebhookEvent = {
      eventId: "evt-rejected-1",
      eventType: "consultation.payment.rejected",
      provider: "slipok",
      paymentId: "payment-1",
      amount: 900
    };

    await persistConsultationPaymentWebhookEvent(tx as never, rejectedEvent);

    expect(mocks.applyConsultationPaymentVerification).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        actorId: null,
        result: expect.objectContaining({
          ok: false,
          status: "rejected",
          transRef: null,
          raw: null
        })
      })
    );
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          verificationPayload: expect.objectContaining({
            providerWebhook: {
              eventId: "evt-rejected-1",
              outcome: "rejected",
              provider: "slipok"
            }
          })
        }
      })
    );
  });

  it.each([
    ["verified", "verified"],
    ["refunded", "verified"]
  ] as const)("treats an exact verified event replay on a %s payment as idempotent", async (status, outcome) => {
    const tx = txMock(
      payment({
        status,
        normalizedTransactionReference: "TRANSFER1",
        consultation: {
          id: "consultation-1",
          patientId: "patient-1",
          status: status === "refunded" ? "cancelled" : "scheduled"
        },
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-verified-1",
            outcome,
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).resolves.toBe("replayed");

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("treats an exact rejected event replay as idempotent despite the pending consultation", async () => {
    const rejectedEvent: ActionableConsultationPaymentWebhookEvent = {
      eventId: "evt-rejected-1",
      eventType: "consultation.payment.rejected",
      provider: "slipok",
      paymentId: "payment-1",
      amount: 900
    };
    const tx = txMock(
      payment({
        status: "rejected",
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-rejected-1",
            outcome: "rejected",
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, rejectedEvent)
    ).resolves.toBe("replayed");

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed when a verified replay changes the canonical amount", async () => {
    const tx = txMock(
      payment({
        status: "verified",
        normalizedTransactionReference: "TRANSFER1",
        consultation: {
          id: "consultation-1",
          patientId: "patient-1",
          status: "scheduled"
        },
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-verified-1",
            outcome: "verified",
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, { ...verifiedEvent, amount: 900.01 })
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed when a rejected replay changes the canonical amount", async () => {
    const rejectedEvent: ActionableConsultationPaymentWebhookEvent = {
      eventId: "evt-rejected-1",
      eventType: "consultation.payment.rejected",
      provider: "slipok",
      paymentId: "payment-1",
      amount: 900.01
    };
    const tx = txMock(
      payment({
        status: "rejected",
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-rejected-1",
            outcome: "rejected",
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, rejectedEvent)
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed when a verified replay changes the transaction reference", async () => {
    const tx = txMock(
      payment({
        status: "verified",
        normalizedTransactionReference: "TRANSFER1",
        consultation: {
          id: "consultation-1",
          patientId: "patient-1",
          status: "scheduled"
        },
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-verified-1",
            outcome: "verified",
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, {
        ...verifiedEvent,
        transactionReference: "transfer-2"
      })
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed when stored replay metadata disagrees with the current consultation state", async () => {
    const tx = txMock(
      payment({
        status: "verified",
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-verified-1",
            outcome: "verified",
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed when a stored event id is replayed with a different semantic outcome", async () => {
    const tx = txMock(
      payment({
        status: "rejected",
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-verified-1",
            outcome: "rejected",
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed instead of overwriting malformed durable event metadata", async () => {
    const tx = txMock(
      payment({
        verificationPayload: {
          providerWebhook: {
            eventId: "evt-verified-1",
            outcome: "unexpected",
            provider: "slipok"
          }
        }
      })
    );

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed when the canonical amount differs from the server-owned payment amount", async () => {
    const tx = txMock();

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, { ...verifiedEvent, amount: 900.01 })
    ).rejects.toBeInstanceOf(ConsultationPaymentWebhookValidationError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("does not apply a new event to a payment that is no longer pending review", async () => {
    const tx = txMock(payment({ status: "verified" }));

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("does not reveal or mutate a payment that is not linked to a consultation", async () => {
    const tx = txMock();
    tx.payment.findUnique = vi.fn().mockResolvedValueOnce({ consultationId: null });

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).rejects.toBeInstanceOf(ConsultationPaymentWebhookNotActionableError);

    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });

  it("fails closed when another transaction wins the event claim", async () => {
    const tx = txMock();
    tx.payment.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      persistConsultationPaymentWebhookEvent(tx as never, verifiedEvent)
    ).rejects.toBeInstanceOf(PaymentVerificationConflictError);

    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });
});
