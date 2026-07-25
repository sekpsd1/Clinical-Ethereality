import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { exchangeLineAuthorizationCode } from "@/lib/auth/line";
import {
  getLineOAuthCookieOptions,
  lineOAuthCookieNames,
  normalizeLineAuthNextPath
} from "@/lib/auth/line-oauth";
import { createAuthSessionRecord, setSessionCookies } from "@/lib/auth/session";
import { upsertLineCustomer } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

function readNextPath(request: NextRequest): string {
  const value = request.cookies.get(lineOAuthCookieNames.next)?.value;

  try {
    return normalizeLineAuthNextPath(value ? decodeURIComponent(value) : undefined);
  } catch {
    return "/consult/assessment";
  }
}

function statesMatch(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

function clearLineOAuthCookies(response: NextResponse): NextResponse {
  const options = getLineOAuthCookieOptions();
  response.cookies.set(lineOAuthCookieNames.state, "", { ...options, maxAge: 0 });
  response.cookies.set(lineOAuthCookieNames.next, "", { ...options, maxAge: 0 });
  return response;
}

function redirectToAuthError(request: NextRequest, nextPath: string, error: string): NextResponse {
  const url = new URL("/auth/line", request.nextUrl.origin);
  url.searchParams.set("next", nextPath);
  url.searchParams.set("error", error);
  return clearLineOAuthCookies(NextResponse.redirect(url));
}

export async function GET(request: NextRequest) {
  const nextPath = readNextPath(request);
  const providerError = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(lineOAuthCookieNames.state)?.value;

  if (providerError || !code) {
    return redirectToAuthError(request, nextPath, "cancelled");
  }

  if (!statesMatch(expectedState, state)) {
    return redirectToAuthError(request, nextPath, "state");
  }

  try {
    const identity = await exchangeLineAuthorizationCode(code);
    const session = await upsertLineCustomer(identity);
    const authSession = await createAuthSessionRecord(session, {
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
    });
    const response = NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
    await setSessionCookies(response, authSession);
    return clearLineOAuthCookies(response);
  } catch (error) {
    console.error("LINE OAuth callback failed.", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    return redirectToAuthError(request, nextPath, "session");
  }
}

export async function POST() {
  return NextResponse.json({ ok: false }, { status: 405 });
}
