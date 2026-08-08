import { NextRequest, NextResponse } from "next/server";
import { getRoleHomePath } from "@/features/auth/role-routing";
import { InvalidAccessTokenError, verifyAccessTokenAtEdge } from "@/lib/auth/edge-jwt";
import { authCookieNames } from "@/lib/auth/cookies";
import { getPublicAppOrigin } from "@/lib/auth/line-oauth";
import { authReturnPathHeader } from "@/lib/auth/return-path";
import {
  InvalidRefreshSessionError,
  RefreshSessionConflictError,
  rotateSessionFromToken,
  setRotatedSessionCookies
} from "@/lib/auth/session";
import type { Role } from "@/lib/permissions/roles";

const protectedPrefixes = ["/consult", "/store", "/community", "/notifications", "/profile"];
const maxConcurrentRefreshRetries = 3;
const concurrentRefreshRetryBaseMs = 75;

const roleProtectedPrefixes: Array<{
  prefix: string;
  roles: readonly Role[];
}> = [
  {
    prefix: "/admin",
    roles: ["admin"]
  },
  {
    prefix: "/doctor",
    roles: ["doctor", "admin"]
  },
  {
    prefix: "/pharmacist",
    roles: ["pharmacist", "admin"]
  }
];

function pathStartsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function clearRefreshRetryCookie(request: NextRequest, response: NextResponse): NextResponse {
  if (request.cookies.get(authCookieNames.refreshRetry)) {
    response.cookies.set(authCookieNames.refreshRetry, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
  }

  return response;
}

function createAuthRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const signInUrl = new URL("/auth/line", getPublicAppOrigin(request.nextUrl.origin));

  signInUrl.searchParams.set("next", `${url.pathname}${url.search}`);

  return clearRefreshRetryCookie(request, NextResponse.redirect(signInUrl));
}

function createRoleHomeRedirect(request: NextRequest, role: Role): NextResponse {
  return NextResponse.redirect(new URL(getRoleHomePath(role), getPublicAppOrigin(request.nextUrl.origin)));
}

function createRefreshedRequestRedirect(request: NextRequest): NextResponse {
  const destination = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, getPublicAppOrigin(request.nextUrl.origin));
  return NextResponse.redirect(destination);
}

function createProtectedRequestContinuation(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(authReturnPathHeader, `${request.nextUrl.pathname}${request.nextUrl.search}`);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

function getConcurrentRefreshRetryCount(request: NextRequest): number {
  const parsed = Number.parseInt(request.cookies.get(authCookieNames.refreshRetry)?.value ?? "0", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function retryConcurrentRefresh(request: NextRequest): Promise<NextResponse> {
  const retryCount = getConcurrentRefreshRetryCount(request);

  if (retryCount >= maxConcurrentRefreshRetries) {
    const response = NextResponse.json(
      { ok: false, error: "Session refresh is still synchronizing. Please retry." },
      { status: 503, headers: { "cache-control": "no-store", "retry-after": "1" } }
    );
    return clearRefreshRetryCookie(request, response);
  }

  await new Promise((resolve) => setTimeout(resolve, concurrentRefreshRetryBaseMs * 2 ** retryCount));
  const response = createRefreshedRequestRedirect(request);
  response.headers.set("cache-control", "no-store");
  response.cookies.set(authCookieNames.refreshRetry, String(retryCount + 1), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30
  });
  return response;
}

function isAllowedRole(roleBoundary: (typeof roleProtectedPrefixes)[number] | undefined, role: Role): boolean {
  return !roleBoundary || roleBoundary.roles.includes(role);
}

async function refreshProtectedRequest(
  request: NextRequest,
  roleBoundary: (typeof roleProtectedPrefixes)[number] | undefined
): Promise<NextResponse> {
  const refreshToken = request.cookies.get(authCookieNames.refresh)?.value;

  if (!refreshToken) {
    return getConcurrentRefreshRetryCount(request) > 0
      ? retryConcurrentRefresh(request)
      : createAuthRedirect(request);
  }

  try {
    const rotation = await rotateSessionFromToken(refreshToken);
    const response = isAllowedRole(roleBoundary, rotation.session.role)
      ? createRefreshedRequestRedirect(request)
      : createRoleHomeRedirect(request, rotation.session.role);

    return setRotatedSessionCookies(response, rotation);
  } catch (error) {
    if (error instanceof RefreshSessionConflictError) {
      return retryConcurrentRefresh(request);
    }

    if (error instanceof InvalidRefreshSessionError) {
      return getConcurrentRefreshRetryCount(request) > 0
        ? retryConcurrentRefresh(request)
        : createAuthRedirect(request);
    }

    throw error;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const roleBoundary = roleProtectedPrefixes.find((boundary) => pathStartsWith(pathname, boundary.prefix));
  const isProtectedCustomerRoute = protectedPrefixes.some((prefix) => pathStartsWith(pathname, prefix));

  if (!isProtectedCustomerRoute && !roleBoundary) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(authCookieNames.access)?.value;

  if (!accessToken) {
    return refreshProtectedRequest(request, roleBoundary);
  }

  try {
    const claims = await verifyAccessTokenAtEdge(accessToken);

    if (!isAllowedRole(roleBoundary, claims.role)) {
      return clearRefreshRetryCookie(request, createRoleHomeRedirect(request, claims.role));
    }

    return clearRefreshRetryCookie(request, createProtectedRequestContinuation(request));
  } catch (error) {
    if (error instanceof InvalidAccessTokenError) {
      return refreshProtectedRequest(request, roleBoundary);
    }

    throw error;
  }
}

export const config = {
  runtime: "nodejs",
  matcher: [
    "/consult/:path*",
    "/store/:path*",
    "/community/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/doctor/:path*",
    "/pharmacist/:path*"
  ]
};
