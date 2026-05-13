import { NextRequest, NextResponse } from "next/server";
import { verifyAccessTokenAtEdge } from "@/lib/auth/edge-jwt";
import { authCookieNames } from "@/lib/auth/cookies";
import type { Role } from "@/lib/permissions/roles";

const protectedPrefixes = ["/consult", "/store", "/community", "/notifications", "/profile"];

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

function createAuthRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const signInUrl = new URL("/auth/line", request.url);

  signInUrl.searchParams.set("next", `${url.pathname}${url.search}`);

  return NextResponse.redirect(signInUrl);
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
    return createAuthRedirect(request);
  }

  try {
    const claims = await verifyAccessTokenAtEdge(accessToken);

    if (roleBoundary && !roleBoundary.roles.includes(claims.role)) {
      return NextResponse.redirect(new URL("/consult", request.url));
    }

    return NextResponse.next();
  } catch {
    return createAuthRedirect(request);
  }
}

export const config = {
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
