import { NextRequest, NextResponse } from "next/server";
import { runLineBookingSmoke } from "@/features/notifications/line-booking-smoke";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  try {
    const { status, body } = await runLineBookingSmoke(request.headers);
    return NextResponse.json(body, { status, headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
