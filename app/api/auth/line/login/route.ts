import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getLineOAuthCookieOptions,
  getPublicAppOrigin,
  lineOAuthCookieNames,
  normalizeLineAuthNextPath
} from "@/lib/auth/line-oauth";
import { getAppEnv } from "@/lib/env/schema";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const nextPath = normalizeLineAuthNextPath(request.nextUrl.searchParams.get("next"));
  const { LINE_CHANNEL_ID, LINE_LOGIN_CALLBACK_URL } = getAppEnv();

  if (!LINE_CHANNEL_ID || !LINE_LOGIN_CALLBACK_URL) {
    const errorUrl = new URL("/auth/line", getPublicAppOrigin(request.nextUrl.origin));
    errorUrl.searchParams.set("next", nextPath);
    errorUrl.searchParams.set("error", "configuration");
    return NextResponse.redirect(errorUrl);
  }

  const state = randomBytes(32).toString("base64url");
  const authorizationUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", LINE_CHANNEL_ID);
  authorizationUrl.searchParams.set("redirect_uri", LINE_LOGIN_CALLBACK_URL);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("scope", "openid profile");

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(lineOAuthCookieNames.state, state, getLineOAuthCookieOptions());
  response.cookies.set(lineOAuthCookieNames.next, encodeURIComponent(nextPath), getLineOAuthCookieOptions());
  return response;
}
