import { NextRequest, NextResponse } from "next/server";
import { authCookieNames } from "@/lib/auth/cookies";
import { refreshSessionFromToken, setSessionCookies } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(authCookieNames.refresh)?.value;

  if (!refreshToken) {
    return NextResponse.json({ ok: false, error: "Refresh session is required." }, { status: 401 });
  }

  try {
    const session = await refreshSessionFromToken(refreshToken);
    const response = NextResponse.json({
      ok: true,
      session: {
        userId: session.userId,
        lineUserId: session.lineUserId,
        role: session.role,
        displayName: session.displayName,
        pictureUrl: session.pictureUrl
      }
    });

    return setSessionCookies(response, session);
  } catch {
    return NextResponse.json({ ok: false, error: "Refresh session is invalid or expired." }, { status: 401 });
  }
}
