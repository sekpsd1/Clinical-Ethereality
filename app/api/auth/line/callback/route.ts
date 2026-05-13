import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const redirectTo = state?.startsWith("/") && !state.startsWith("//") ? state : "/auth/line";

  return NextResponse.redirect(new URL(redirectTo, request.nextUrl.origin));
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "LINE callback handling is not configured for this LIFF-first MVP flow."
    },
    { status: 501 }
  );
}
