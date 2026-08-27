import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  env: {
    PAYMENT_WEBHOOK_SECRET: "payment-webhook-secret" as string | undefined,
    SLIP_VERIFICATION_PROVIDER: "slipok" as "slipok" | "easyslip" | undefined
  },
  persistWebhookEvent: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: () => mocks.env
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/features/consultations/payment/webhook-service", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/features/consultations/payment/webhook-service")
  >();

  return {
    ...original,
    persistConsultationPaymentWebhookEvent: mocks.persistWebhookEvent
  };
});

import { POST } from "@/app/api/webhooks/payments/route";
import {
  ConsultationPaymentWebhookNotActionableError,
  ConsultationPaymentWebhookValidationError
} from "@/features/consultations/payment/webhook-service";
import { PaymentVerificationConflictError } from "@/features/payments/service";

const verifiedEvent = {
  eventId: "evt-verified-1",
  eventType: "consultation.payment.verified",
  provider: "slipok",
  paymentId: "payment-1",
  amount: 900,
  receiverVerified: true,
  transactionReference: "transfer-1"
} as const;

function request(body: unknown, secret = "payment-webhook-secret") {
  return new NextRequest("http://localhost/api/webhooks/payments", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-clinical-webhook-secret": secret
    }
  });
}

describe("consultation payment webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.PAYMENT_WEBHOOK_SECRET = "payment-webhook-secret";
    mocks.env.SLIP_VERIFICATION_PROVIDER = "slipok";
    mocks.persistWebhookEvent.mockResolvedValue("processed");
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({}));
  });

  it("rejects an unauthorized request before parsing or persistence", async () => {
    const response = await POST(request(verifiedEvent, "wrong-secret"));

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.persistWebhookEvent).not.toHaveBeenCalled();
  });

  it("fails closed when the webhook secret is not configured", async () => {
    mocks.env.PAYMENT_WEBHOOK_SECRET = undefined;

    const response = await POST(request(verifiedEvent));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(JSON.stringify(body)).not.toContain("payment-webhook-secret");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    "not-json",
    { ...verifiedEvent, eventType: "payment.succeeded" },
    { ...verifiedEvent, receiverVerified: false },
    { ...verifiedEvent, amount: 900.001 },
    { ...verifiedEvent, transactionReference: "invalid reference !" },
    { ...verifiedEvent, raw: { account: "must-not-be-accepted" } },
    { event: "native.slipok.shape", data: { paymentId: "payment-1" } }
  ])("rejects malformed, unknown, or non-canonical input without persistence", async (body) => {
    const response = await POST(request(body));
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ ok: false, error: "Payment webhook payload is invalid." });
    expect(JSON.stringify(responseBody)).not.toContain("must-not-be-accepted");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects an oversized body before persistence", async () => {
    const response = await POST(request("x".repeat(16 * 1024 + 1)));

    expect(response.status).toBe(413);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a canonical event for a provider other than the configured provider", async () => {
    const response = await POST(request({ ...verifiedEvent, provider: "easyslip" }));

    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("persists a verified event in a Serializable transaction and returns no identifiers", async () => {
    const response = await POST(request(verifiedEvent));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain("payment-1");
    expect(JSON.stringify(body)).not.toContain("transfer-1");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
    expect(mocks.persistWebhookEvent).toHaveBeenCalledWith(expect.anything(), verifiedEvent);
  });

  it("accepts a rejected event through the same persistence boundary", async () => {
    const rejectedEvent = {
      eventId: "evt-rejected-1",
      eventType: "consultation.payment.rejected",
      provider: "slipok",
      paymentId: "payment-1",
      amount: 900
    } as const;

    const response = await POST(request(rejectedEvent));

    expect(response.status).toBe(200);
    expect(mocks.persistWebhookEvent).toHaveBeenCalledWith(expect.anything(), rejectedEvent);
  });

  it("returns the same generic success for an exact replay", async () => {
    mocks.persistWebhookEvent.mockResolvedValue("replayed");

    const response = await POST(request(verifiedEvent));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("ignores provider-error events without opening a database transaction", async () => {
    const response = await POST(
      request({
        eventId: "evt-provider-error-1",
        eventType: "consultation.payment.provider_error",
        provider: "slipok",
        paymentId: "payment-1"
      })
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does not reveal whether a valid event mapped to a consultation payment", async () => {
    mocks.persistWebhookEvent.mockRejectedValue(new ConsultationPaymentWebhookNotActionableError());

    const response = await POST(request(verifiedEvent));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
  });

  it.each([
    new ConsultationPaymentWebhookValidationError(),
    new PaymentVerificationConflictError(),
    { code: "P2034" }
  ])("returns a generic conflict without leaking event data", async (error) => {
    mocks.persistWebhookEvent.mockRejectedValue(error);

    const response = await POST(request(verifiedEvent));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ ok: false, error: "Payment webhook event could not be applied." });
    expect(JSON.stringify(body)).not.toContain("evt-verified-1");
  });

  it("returns a generic provider-independent error for an unexpected persistence failure", async () => {
    mocks.persistWebhookEvent.mockRejectedValue(new Error("private database path"));

    const response = await POST(request(verifiedEvent));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ ok: false, error: "Payment webhook is temporarily unavailable." });
    expect(JSON.stringify(body)).not.toContain("private database path");
  });
});
