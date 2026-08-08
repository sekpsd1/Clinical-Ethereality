import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAppEnv } from "@/lib/env/schema";
import { releaseExpiredStoreOrderReservations } from "@/features/orders/reservations";

export const dynamic = "force-dynamic";

function secretsMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function isAuthorized(secret: string, request: NextRequest): boolean {
  return secretsMatch(secret, request.headers.get("x-clinical-job-secret") ?? "");
}

export async function POST(request: NextRequest) {
  const env = getAppEnv();

  if (!env.STORE_RESERVATION_CLEANUP_SECRET) {
    return NextResponse.json(
      { ok: false, error: "Store reservation cleanup is not configured." },
      { status: 503 }
    );
  }

  if (!isAuthorized(env.STORE_RESERVATION_CLEANUP_SECRET, request)) {
    return NextResponse.json(
      { ok: false, error: "Store reservation cleanup request is unauthorized." },
      { status: 401 }
    );
  }

  const result = await releaseExpiredStoreOrderReservations();

  return NextResponse.json({
    ok: true,
    result
  });
}
