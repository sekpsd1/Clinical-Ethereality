import { NextRequest, NextResponse } from "next/server";
import { authCookieNames } from "@/lib/auth/cookies";
import {
  InvalidRefreshSessionError,
  RefreshSessionConflictError,
  rotateSessionFromToken,
  setRotatedSessionCookies
} from "@/lib/auth/session";

const maxConcurrentRefreshRetries = 3;

function getConcurrentRefreshRetryCount(request: NextRequest): number {
  const parsed = Number.parseInt(request.cookies.get(authCookieNames.refreshRetry)?.value ?? "0", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function clearRefreshRetryCookie(response: NextResponse): NextResponse {
  response.cookies.set(authCookieNames.refreshRetry, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

function createConcurrentRefreshResponse(request: NextRequest): NextResponse {
  const retryCount = getConcurrentRefreshRetryCount(request);

  if (retryCount >= maxConcurrentRefreshRetries) {
    return clearRefreshRetryCookie(
      NextResponse.json(
        { ok: false, error: "Session refresh is still synchronizing. Please retry." },
        { status: 503, headers: { "cache-control": "no-store", "retry-after": "1" } }
      )
    );
  }

  const response = NextResponse.json(
    { ok: false, error: "Refresh session rotation is already in progress." },
    { status: 409, headers: { "cache-control": "no-store", "retry-after": "0" } }
  );
  response.cookies.set(authCookieNames.refreshRetry, String(retryCount + 1), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30
  });
  return response;
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(authCookieNames.refresh)?.value;

  if (!refreshToken) {
    if (getConcurrentRefreshRetryCount(request) > 0) {
      return createConcurrentRefreshResponse(request);
    }

    return NextResponse.json({ ok: false, error: "Refresh session is required." }, { status: 401 });
  }

  try {
    const rotation = await rotateSessionFromToken(refreshToken);
    const { session } = rotation;
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

    return setRotatedSessionCookies(response, rotation);
  } catch (error) {
    if (error instanceof RefreshSessionConflictError) {
      return createConcurrentRefreshResponse(request);
    }

    if (error instanceof InvalidRefreshSessionError && getConcurrentRefreshRetryCount(request) > 0) {
      return createConcurrentRefreshResponse(request);
    }

    if (error instanceof InvalidRefreshSessionError) {
      return NextResponse.json({ ok: false, error: "Refresh session is invalid or expired." }, { status: 401 });
    }

    return clearRefreshRetryCookie(
      NextResponse.json({ ok: false, error: "Unable to refresh the session." }, { status: 503 })
    );
  }
}
