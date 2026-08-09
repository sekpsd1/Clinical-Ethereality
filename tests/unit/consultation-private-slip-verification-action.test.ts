import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyConsultationPaymentVerification: vi.fn(),
  assertPermission: vi.fn(),
  claimConsultationProviderVerification: vi.fn(),
  findAttachment: vi.fn(),
  findConsultation: vi.fn(),
  findPayment: vi.fn(),
  readPrivatePaymentSlip: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  releaseExpiredConsultationSlotLocks: vi.fn(),
  requireCurrentSession: vi.fn(),
  transaction: vi.fn(),
  validatePaymentSlipContent: vi.fn(),
  verifyPaymentSlip: vi.fn()
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/lib/permissions", () => ({ assertPermission: mocks.assertPermission }));
vi.mock("@/lib/payments/slip-verification", () => ({ verifyPaymentSlip: mocks.verifyPaymentSlip }));
vi.mock("@/features/consultations/booking/lock-release", () => ({
  releaseExpiredConsultationSlotLocks: mocks.releaseExpiredConsultationSlotLocks
}));
vi.mock("@/features/consultations/payment/service", () => ({
  applyConsultationPaymentVerification: mocks.applyConsultationPaymentVerification,
  claimConsultationProviderVerification: mocks.claimConsultationProviderVerification
}));
vi.mock("@/features/payments/private-slips", () => ({
  paymentSlipEntityType: "payment_slip",
  readPrivatePaymentSlip: mocks.readPrivatePaymentSlip,
  validatePaymentSlipContent: mocks.validatePaymentSlipContent
}));
vi.mock("@/features/payments/private-slip-policy", () => ({
  paymentSlipMimeTypes: ["image/png"]
}));
vi.mock("@/features/payments/service", () => {
  class PaymentVerificationRateLimitError extends Error {
    constructor(readonly retryAfterSeconds: number) {
      super("rate limited");
    }
  }

  return { PaymentVerificationRateLimitError };
});
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consultation: { findFirst: mocks.findConsultation },
    payment: { findUnique: mocks.findPayment },
    fileAttachment: { findUnique: mocks.findAttachment },
    $transaction: mocks.transaction
  }
}));

import { verifyConsultationSlipAction } from "@/features/consultations/payment/actions";

const consultation = {
  id: "consultation-1",
  patientId: "customer-1",
  status: "pending_payment",
  doctor: { consultationFee: 1 }
};

const attachment = {
  entityId: "payment-1",
  entityType: "payment_slip",
  fileName: "slip.png",
  mimeType: "image/png",
  ownerId: "customer-1",
  purpose: "payment_slip",
  status: "attached",
  storageKey: "payments/private/slip.png"
};

function formData(attachmentId = "attachment-1") {
  const value = new FormData();
  value.set("consultationId", "consultation-1");
  value.set("attachmentId", attachmentId);
  return value;
}

describe("consultation private-slip verification action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.findConsultation.mockResolvedValue(consultation);
    mocks.findPayment.mockResolvedValue({ id: "payment-1" });
    mocks.findAttachment.mockResolvedValue(attachment);
    mocks.readPrivatePaymentSlip.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: true,
      provider: "slipok",
      status: "verified",
      transRef: "consult-ref-1",
      amount: 1,
      receiverName: "masked",
      transactionTimestamp: "2026-08-09T12:00:00.000Z",
      raw: null
    });
    mocks.transaction.mockImplementation(async (callback: (tx: object) => Promise<void>) => callback({}));
  });

  it("uses validated owner-scoped private bytes and schedules only after a verified provider result", async () => {
    await expect(verifyConsultationSlipAction(formData())).rejects.toThrow(
      "REDIRECT:/consult/waiting-room?consultation=consultation-1"
    );

    expect(mocks.claimConsultationProviderVerification).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ actorId: "customer-1", consultation })
    );
    expect(mocks.verifyPaymentSlip).toHaveBeenCalledWith({
      privateFile: { bytes: expect.any(Uint8Array), fileName: "slip.png", mimeType: "image/png" },
      amount: 1
    });
    expect(mocks.applyConsultationPaymentVerification).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ evidence: { amount: 1, attachmentId: "attachment-1" } })
    );
  });

  it("fails closed before provider access when the attachment is not owned by the customer", async () => {
    mocks.findAttachment.mockResolvedValue({ ...attachment, ownerId: "customer-2" });

    await expect(verifyConsultationSlipAction(formData())).rejects.toThrow(
      "REDIRECT:/consult/payment?consultation=consultation-1&payment=invalid"
    );

    expect(mocks.readPrivatePaymentSlip).not.toHaveBeenCalled();
    expect(mocks.claimConsultationProviderVerification).not.toHaveBeenCalled();
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
  });

  it("keeps the consultation pending when SlipOK is unavailable", async () => {
    mocks.verifyPaymentSlip.mockResolvedValue({ ok: false, provider: "slipok", status: "provider_error", raw: null });

    await expect(verifyConsultationSlipAction(formData())).rejects.toThrow(
      "REDIRECT:/consult/payment?consultation=consultation-1&payment=provider_error"
    );

    expect(mocks.applyConsultationPaymentVerification).not.toHaveBeenCalled();
  });
});
