import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runLineBookingAlerts } from "@/features/notifications/line-booking-job";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.LINE_BOOKING_ALERT_JOB_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ ok: false }, { status: 503 });
  const received = Buffer.from(request.headers.get("x-clinical-job-secret") ?? "");
  const expected = Buffer.from(secret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const result = await runLineBookingAlerts();
    return NextResponse.json({ ok: result.attentionRequired === 0, result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "LINE booking alert job requires attention." }, { status: 503 });
  }
}
