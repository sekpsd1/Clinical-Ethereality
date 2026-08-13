import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  applyProviderPaymentVerification: vi.fn(),
  readPrivatePaymentSlip: vi.fn(),
  transaction: vi.fn(),
  validatePaymentSlipContent: vi.fn(),
  verifyPaymentSlip: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/payments/slip-verification", () => ({
  verifyPaymentSlip: mocks.verifyPaymentSlip
}));

vi.mock("@/features/payments/private-slips", () => ({
  readPrivatePaymentSlip: mocks.readPrivatePaymentSlip,
  validatePaymentSlipContent: mocks.validatePaymentSlipContent
}));

vi.mock("@/features/payments/service", () => ({
  applyProviderPaymentVerification: mocks.applyProviderPaymentVerification
}));

import { verifyUploadedStorePrivateSlip } from "@/features/payments/store-private-slip-verification";

const payment = {
  id: "payment-1",
  orderId: "order-1",
  orderUserId: "customer-1",
  amount: new Prisma.Decimal(120),
  status: "pending_review" as const,
  slipImageUrl: "/api/payments/slips/attachment-1",
  verificationPayload: {
    submittedEvidence: {
      attachmentId: "attachment-1",
      type: "private_file"
    }
  },
  updatedAt: new Date("2026-08-13T10:00:00.000Z")
};

const input = {
  actorId: "customer-1",
  payment,
  privateSlip: {
    fileName: "receipt.png",
    mimeType: "image/png" as const,
    storageKey: "payments/private/receipt.png"
  }
};

describe("automatic Store private-slip verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readPrivatePaymentSlip.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<void>) => callback({}));
  });

  it("verifies the stored private bytes and persists only through the guarded provider service", async () => {
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: true,
      provider: "slipok",
      status: "verified",
      transRef: "provider-reference",
      amount: 120,
      receiverName: "masked receiver",
      raw: { sensitive: "must-not-be-returned" }
    });

    const result = await verifyUploadedStorePrivateSlip(input);

    expect(result).toEqual({ status: "verified", verification: "provider_verified" });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(mocks.readPrivatePaymentSlip).toHaveBeenCalledWith(input.privateSlip.storageKey);
    expect(mocks.validatePaymentSlipContent).toHaveBeenCalledWith(
      "image/png",
      expect.any(Uint8Array)
    );
    expect(mocks.verifyPaymentSlip).toHaveBeenCalledWith({
      amount: 120,
      privateFile: {
        bytes: expect.any(Uint8Array),
        fileName: "receipt.png",
        mimeType: "image/png"
      }
    });
    expect(mocks.applyProviderPaymentVerification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: "customer-1",
        payment,
        source: "private_file"
      })
    );
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  });

  it("persists a provider rejection through the same audited transition", async () => {
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: false,
      provider: "slipok",
      status: "rejected",
      transRef: null,
      amount: 119,
      receiverName: "masked receiver",
      raw: null
    });

    await expect(verifyUploadedStorePrivateSlip(input)).resolves.toEqual({
      status: "rejected",
      verification: "provider_rejected"
    });
    expect(mocks.applyProviderPaymentVerification).toHaveBeenCalledOnce();
  });

  it.each([
    ["provider throws", () => mocks.verifyPaymentSlip.mockRejectedValue(new Error("unavailable"))],
    [
      "provider returns an unavailable result",
      () =>
        mocks.verifyPaymentSlip.mockResolvedValue({
          ok: false,
          provider: "slipok",
          status: "provider_error",
          transRef: null,
          amount: null,
          receiverName: null,
          raw: null
        })
    ]
  ])("keeps the uploaded payment pending when %s", async (_label, arrange) => {
    arrange();

    await expect(verifyUploadedStorePrivateSlip(input)).resolves.toEqual({
      status: "pending_review",
      verification: "manual_review_required"
    });
    expect(mocks.applyProviderPaymentVerification).not.toHaveBeenCalled();
  });

  it("does not call the provider when the stored private file cannot be read or validated", async () => {
    mocks.readPrivatePaymentSlip.mockRejectedValue(new Error("private storage unavailable"));

    await expect(verifyUploadedStorePrivateSlip(input)).resolves.toEqual({
      status: "pending_review",
      verification: "manual_review_required"
    });
    expect(mocks.verifyPaymentSlip).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("falls back to pending review when the guarded persistence transaction loses a race", async () => {
    mocks.verifyPaymentSlip.mockResolvedValue({
      ok: true,
      provider: "slipok",
      status: "verified",
      transRef: "provider-reference",
      amount: 120,
      receiverName: "masked receiver",
      raw: null
    });
    mocks.transaction.mockRejectedValue(new Error("write conflict"));

    await expect(verifyUploadedStorePrivateSlip(input)).resolves.toEqual({
      status: "pending_review",
      verification: "manual_review_required"
    });
  });
});
