import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getAppEnv } from "@/lib/env/schema";
import { prisma } from "@/lib/db/prisma";
import { consultationPaymentWebhookEventSchema } from "@/features/consultations/payment/webhook-schema";
import {
  ConsultationPaymentWebhookNotActionableError,
  ConsultationPaymentWebhookValidationError,
  persistConsultationPaymentWebhookEvent
} from "@/features/consultations/payment/webhook-service";
import {
  DuplicatePaymentTransactionError,
  PaymentVerificationConflictError
} from "@/features/payments/service";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BODY_BYTES = 16 * 1024;
const noStoreHeaders = { "Cache-Control": "no-store" } as const;

function jsonResponse(body: { ok: boolean; error?: string }, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: noStoreHeaders });
}

function secretsMatch(expected: string, received: string): boolean {
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  const receivedDigest = createHash("sha256").update(received, "utf8").digest();

  return timingSafeEqual(expectedDigest, receivedDigest);
}

function isPrismaWriteConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2034"
  );
}

async function readBoundedBody(request: NextRequest): Promise<string | null> {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes).toString("utf8");
}

export async function POST(request: NextRequest) {
  const env = getAppEnv();
  const receivedSecret = request.headers.get("x-clinical-webhook-secret") ?? "";

  if (!env.PAYMENT_WEBHOOK_SECRET || !secretsMatch(env.PAYMENT_WEBHOOK_SECRET, receivedSecret)) {
    return jsonResponse(
      { ok: false, error: "Payment webhook is not configured or the request is unauthorized." },
      401
    );
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "Payment webhook payload is too large." }, 413);
  }

  let rawBody: string | null;

  try {
    rawBody = await readBoundedBody(request);
  } catch {
    return jsonResponse({ ok: false, error: "Payment webhook payload is invalid." }, 400);
  }

  if (rawBody === null) {
    return jsonResponse({ ok: false, error: "Payment webhook payload is too large." }, 413);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ ok: false, error: "Payment webhook payload is invalid." }, 400);
  }

  const parsed = consultationPaymentWebhookEventSchema.safeParse(payload);

  if (!parsed.success) {
    return jsonResponse({ ok: false, error: "Payment webhook payload is invalid." }, 400);
  }

  if (!env.SLIP_VERIFICATION_PROVIDER || parsed.data.provider !== env.SLIP_VERIFICATION_PROVIDER) {
    return jsonResponse(
      { ok: false, error: "Payment webhook is not configured or the request is unauthorized." },
      401
    );
  }

  if (parsed.data.eventType === "consultation.payment.provider_error") {
    return jsonResponse({ ok: true }, 202);
  }

  const actionableEvent = parsed.data;

  try {
    await prisma.$transaction(
      (tx) => persistConsultationPaymentWebhookEvent(tx, actionableEvent),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    if (error instanceof ConsultationPaymentWebhookNotActionableError) {
      return jsonResponse({ ok: true }, 202);
    }

    if (
      error instanceof ConsultationPaymentWebhookValidationError ||
      error instanceof DuplicatePaymentTransactionError ||
      error instanceof PaymentVerificationConflictError ||
      isPrismaWriteConflict(error)
    ) {
      return jsonResponse({ ok: false, error: "Payment webhook event could not be applied." }, 409);
    }

    return jsonResponse({ ok: false, error: "Payment webhook is temporarily unavailable." }, 503);
  }
}
