import { NextRequest, NextResponse } from "next/server";
import { getAppEnv } from "@/lib/env/schema";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const env = getAppEnv();

  if (!env.PAYMENT_WEBHOOK_SECRET) {
    return false;
  }

  return request.headers.get("x-clinical-webhook-secret") === env.PAYMENT_WEBHOOK_SECRET;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Payment webhook is not configured or the request is unauthorized."
      },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Payment webhook persistence is not implemented yet."
    },
    { status: 501 }
  );
}
