import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  applyProviderPaymentVerification: vi.fn(),
  canReadOwnRecord: vi.fn(),
  claimProviderPaymentVerification: vi.fn(),
  findAttachment: vi.fn(),
  findPayment: vi.fn(),
  getCurrentSession: vi.fn(),
  hasPermission: vi.fn(),
  releaseExpiredStoreOrderReservations: vi.fn(),
  readPrivatePaymentSlip: vi.fn(),
  transaction: vi.fn(),
  validatePaymentSlipContent: vi.fn(),
  verifyPaymentSlip: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    payment: {
      findUnique: mocks.findPayment
    },
    fileAttachment: {
      findUnique: mocks.findAttachment
    },
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/permissions", () => ({
  canReadOwnRecord: mocks.canReadOwnRecord,
  hasPermission: mocks.hasPermission
}));

vi.mock("@/lib/payments/slip-verification", () => ({
  verifyPaymentSlip: mocks.verifyPaymentSlip
}));

vi.mock("@/features/payments/private-slips", () => ({
  paymentSlipEntityType: "payment_slip",
  readPrivatePaymentSlip: mocks.readPrivatePaymentSlip,
  validatePaymentSlipContent: mocks.validatePaymentSlipContent
}));

vi.mock("@/features/orders/reservations", () => ({
  isStorePaymentReviewExpired: (createdAt: Date, now = new Date()) =>
    createdAt.getTime() + 24 * 60 * 60 * 1000 <= now.getTime(),
  isStoreReservationExpired: (createdAt: Date, now = new Date()) =>
    createdAt.getTime() + 30 * 60 * 1000 <= now.getTime(),
  releaseExpiredStoreOrderReservations: mocks.releaseExpiredStoreOrderReservations
}));

vi.mock("@/features/payments/service", () => {
  class DuplicatePaymentTransactionError extends Error {}
  class PaymentVerificationConflictError extends Error {}
  class PaymentVerificationRateLimitError extends Error {
    constructor(readonly retryAfterSeconds: number) {
      super();
    }
  }

  return {
    applyProviderPaymentVerification: mocks.applyProviderPaymentVerification,
    claimProviderPaymentVerification: mocks.claimProviderPaymentVerification,
    DuplicatePaymentTransactionError,
    PaymentVerificationConflictError,
    PaymentVerificationRateLimitError
  };
});

import { POST } from "@/app/api/payments/verify-slip/route";
import {
  PaymentVerificationConflictError,
  PaymentVerificationRateLimitError
} from "@/features/payments/service";

const payment = {
  id: "payment-1",
  amount: new Prisma.Decimal(1200),
  status: "pending_slip",
  slipImageUrl: null,
  verificationPayload: {
    checkoutRequestId: "checkout-1",
    source: "customer_checkout_foundation"
  },
  reviewedAt: null,
  updatedAt: new Date("2026-07-30T10:00:00.000Z"),
  order: {
    id: "order-1",
    userId: "customer-1",
    status: "pending_payment",
    createdAt: new Date()
  }
};
const claimedPayment = {
  id: payment.id,
  orderId: payment.order.id,
  orderUserId: payment.order.userId,
  amount: payment.amount,
  status: "pending_review" as const,
  slipImageUrl: null,
  verificationPayload: {
    checkoutRequestId: "checkout-1",
    source: "customer_checkout_foundation",
    submittedEvidence: {
      type: "qr_payload",
      qrPayload: "slip-qr-payload"
    }
  },
  updatedAt: new Date("2026-07-30T12:00:00.000Z")
};

function createRequest(
  body: Record<string, unknown> = {
    paymentId: payment.id,
    qrPayload: "slip-qr-payload"
  }
) {
  return new NextRequest("http://localhost/api/payments/verify-slip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("store payment slip verification route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSession.mockResolvedValue({
      userId: "customer-1",
      role: "customer"
    });
    mocks.findPayment.mockResolvedValue(payment);
    mocks.claimProviderPaymentVerification.mockResolvedValue(claimedPayment);
    mocks.canReadOwnRecord.mockReturnValue(true);
    mocks.hasPermission.mockReturnValue(false);
    mocks.releaseExpiredStoreOrderReservations.mockResolvedValue({
      candidates: 0,
      released: 0,
      skipped: 0
    });
    mocks.findAttachment.mockResolvedValue(null);
    mocks.readPrivatePaymentSlip.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => callback({}));
  });

  it("requires exactly one slip evidence source", async () => {
    const response = await POST(
      createRequest({
        paymentId: payment.id,
        qrPayload: "slip-qr-payload",
        imageUrl: "https://cdn.example.com/slip.png"
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.findPayment).not.toHaveBeenCalled();
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
  });

  it.each([
    {
      paymentId: "p".repeat(192),
      qrPayload: "slip-qr-payload"
    },
    {
      paymentId: payment.id,
      qrPayload: "q".repeat(4097)
    },
    {
      paymentId: payment.id,
      imageUrl: `https://cdn.example.com/${"a".repeat(2030)}.png`
    }
  ])("rejects oversized payment verification input before database access", async (body) => {
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
    expect(mocks.findPayment).not.toHaveBeenCalled();
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
  });

  it("does not persist a provider error as a rejected payment", async () => {
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: false,
      provider: "easyslip",
      status: "provider_error",
      transRef: null,
      amount: null,
      receiverName: null,
      raw: {
        providerError: "temporarily unavailable"
      }
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(503);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.claimProviderPaymentVerification).toHaveBeenCalledOnce();
    expect(mocks.applyProviderPaymentVerification).not.toHaveBeenCalled();
    expect(mocks.claimProviderPaymentVerification.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.verifyPaymentSlip.mock.invocationCallOrder[0]
    );
  });

  it("releases and blocks an expired reservation before calling the provider", async () => {
    mocks.findPayment.mockResolvedValue({
      ...payment,
      order: {
        ...payment.order,
        createdAt: new Date(Date.now() - 31 * 60 * 1000)
      }
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(409);
    expect(mocks.releaseExpiredStoreOrderReservations).toHaveBeenCalledWith({
      now: expect.any(Date),
      userId: "customer-1"
    });
    expect(mocks.claimProviderPaymentVerification).not.toHaveBeenCalled();
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
  });

  it("returns only the normalized verification status and never returns raw provider data", async () => {
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: true,
      provider: "easyslip",
      status: "verified",
      transRef: "transfer-1",
      amount: 1200,
      receiverName: "Clinical Ethereality",
      raw: {
        privateProviderPayload: "must-not-reach-the-client"
      }
    });

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      status: "verified"
    });
    expect(JSON.stringify(body)).not.toContain("must-not-reach-the-client");
    expect(mocks.applyProviderPaymentVerification).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.applyProviderPaymentVerification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payment: claimedPayment
      })
    );
  });

  it("reads an owned private attachment into provider bytes without accepting a hosted URL", async () => {
    mocks.findAttachment.mockResolvedValue({
      entityId: payment.id,
      entityType: "payment_slip",
      fileName: "private-slip.png",
      mimeType: "image/png",
      ownerId: "customer-1",
      purpose: "payment_slip",
      status: "attached",
      storageKey: "payments/private/storage-key.png"
    });
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: false,
      provider: "slipok",
      status: "rejected",
      transRef: null,
      amount: 1200,
      receiverName: "Clinical Ethereality",
      raw: null
    });

    const response = await POST(createRequest({ paymentId: payment.id, attachmentId: "attachment-1" }));

    expect(response.status).toBe(200);
    expect(mocks.readPrivatePaymentSlip).toHaveBeenCalledWith("payments/private/storage-key.png");
    expect(mocks.verifyPaymentSlip).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1200,
        imageUrl: undefined,
        privateFile: expect.objectContaining({ fileName: "private-slip.png", mimeType: "image/png" })
      })
    );
    expect(mocks.claimProviderPaymentVerification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ privateSlipAttachmentId: "attachment-1", source: "private_file" })
    );
  });

  it("does not reveal another private attachment or call the provider", async () => {
    mocks.findAttachment.mockResolvedValue({
      entityId: "other-payment",
      entityType: "payment_slip",
      fileName: "other.png",
      mimeType: "image/png",
      ownerId: "customer-2",
      purpose: "payment_slip",
      status: "attached",
      storageKey: "payments/other.png"
    });

    const response = await POST(createRequest({ paymentId: payment.id, attachmentId: "attachment-foreign" }));

    expect(response.status).toBe(404);
    expect(mocks.readPrivatePaymentSlip).not.toHaveBeenCalled();
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
  });

  it("accepts a new verification attempt after a previous rejection", async () => {
    mocks.findPayment.mockResolvedValue({
      ...payment,
      status: "rejected"
    });
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: true,
      provider: "slipok",
      status: "verified",
      transRef: "transfer-retry",
      amount: 1200,
      receiverName: "Clinical Ethereality",
      raw: null
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(mocks.claimProviderPaymentVerification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paymentId: "payment-1"
      })
    );
    expect(mocks.applyProviderPaymentVerification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payment: expect.objectContaining({
          status: "pending_review"
        })
      })
    );
  });

  it("rate limits a rejected-payment retry using its persisted timestamp", async () => {
    mocks.findPayment.mockResolvedValue({
      ...payment,
      status: "rejected",
      reviewedAt: new Date("2026-07-30T12:00:00.000Z"),
      updatedAt: new Date("2026-07-30T12:00:00.000Z")
    });
    mocks.claimProviderPaymentVerification.mockRejectedValue(
      new PaymentVerificationRateLimitError(17)
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(body.error).toContain("17");
    expect(mocks.claimProviderPaymentVerification).toHaveBeenCalledOnce();
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("returns a conflict when another request wins the evidence claim CAS", async () => {
    mocks.claimProviderPaymentVerification.mockRejectedValue(
      new PaymentVerificationConflictError()
    );

    const response = await POST(createRequest());

    expect(response.status).toBe(409);
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
    expect(mocks.applyProviderPaymentVerification).not.toHaveBeenCalled();
  });

  it("maps a serializable transaction write conflict to HTTP 409", async () => {
    mocks.claimProviderPaymentVerification.mockRejectedValue({
      code: "P2034"
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(409);
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
  });
});
