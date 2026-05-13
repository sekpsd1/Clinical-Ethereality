import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { issueSessionToken, verifySessionToken, getSessionTtlSeconds } from "@/lib/auth/jwt";
import { authCookieNames } from "@/lib/auth/cookies";
import type { AuthSession, PublicSession, SessionClaims } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { isRole } from "@/lib/permissions/roles";

function toPublicSession(claims: SessionClaims): PublicSession {
  return {
    userId: claims.userId,
    lineUserId: claims.lineUserId,
    role: claims.role,
    displayName: claims.displayName,
    pictureUrl: claims.pictureUrl,
    expiresAt: new Date(claims.exp * 1000).toISOString()
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAuthSessionRecord(
  session: AuthSession,
  metadata?: {
    userAgent?: string | null;
    ipAddress?: string | null;
  }
): Promise<AuthSession> {
  const authSession = await prisma.authSession.create({
    data: {
      userId: session.userId,
      userAgent: metadata?.userAgent ?? undefined,
      ipAddress: metadata?.ipAddress ?? undefined,
      expiresAt: new Date(Date.now() + getSessionTtlSeconds("refresh") * 1000)
    }
  });

  return {
    ...session,
    sessionId: authSession.id
  };
}

export async function getCurrentSession(): Promise<PublicSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(authCookieNames.access)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    return toPublicSession(await verifySessionToken(accessToken, "access"));
  } catch {
    return null;
  }
}

export async function requireCurrentSession(): Promise<PublicSession> {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Authentication is required.");
  }

  return session;
}

export async function setSessionCookies(response: NextResponse, session: AuthSession): Promise<NextResponse> {
  const [accessToken, refreshToken] = await Promise.all([
    issueSessionToken(session, "access"),
    issueSessionToken(session, "refresh")
  ]);

  response.cookies.set(authCookieNames.access, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds("access")
  });
  response.cookies.set(authCookieNames.refresh, refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds("refresh")
  });

  if (session.sessionId) {
    await prisma.authSession.update({
      where: {
        id: session.sessionId
      },
      data: {
        refreshTokenHash: hashToken(refreshToken),
        status: "active",
        expiresAt: new Date(Date.now() + getSessionTtlSeconds("refresh") * 1000),
        revokedAt: null
      }
    });
  }

  return response;
}

export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.set(authCookieNames.access, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  response.cookies.set(authCookieNames.refresh, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}

export async function refreshSessionFromToken(refreshToken: string): Promise<AuthSession> {
  const claims = await verifySessionToken(refreshToken, "refresh");
  const sessionId = claims.sessionId;

  if (!sessionId) {
    throw new Error("Refresh session ID is required.");
  }

  const authSession = await prisma.authSession.findUnique({
    where: {
      id: sessionId
    },
    include: {
      user: true
    }
  });

  if (
    !authSession ||
    authSession.status !== "active" ||
    authSession.expiresAt <= new Date() ||
    authSession.refreshTokenHash !== hashToken(refreshToken) ||
    authSession.user.status !== "active" ||
    authSession.user.id !== claims.userId ||
    !isRole(authSession.user.role)
  ) {
    throw new Error("Refresh session is invalid or expired.");
  }

  return {
    userId: authSession.user.id,
    lineUserId: authSession.user.lineUserId,
    role: authSession.user.role,
    sessionId: authSession.id,
    displayName: authSession.user.displayName ?? undefined,
    pictureUrl: authSession.user.avatarUrl ?? undefined
  };
}

export async function revokeSessionFromToken(refreshToken: string): Promise<void> {
  const claims = await verifySessionToken(refreshToken, "refresh");

  if (!claims.sessionId) {
    return;
  }

  await prisma.authSession.updateMany({
    where: {
      id: claims.sessionId,
      refreshTokenHash: hashToken(refreshToken)
    },
    data: {
      status: "revoked",
      revokedAt: new Date()
    }
  });
}
