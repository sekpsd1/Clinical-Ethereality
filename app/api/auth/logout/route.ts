import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authCookieNames } from "@/lib/auth/cookies";
import { clearSessionCookies, revokeSessionFromToken } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(authCookieNames.refresh)?.value;

  if (refreshToken) {
    await revokeSessionFromToken(refreshToken).catch(() => undefined);
  }

  return clearSessionCookies(NextResponse.json({ ok: true }));
}
