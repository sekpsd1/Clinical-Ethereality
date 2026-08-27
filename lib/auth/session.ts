import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import {
  InvalidSessionTokenError,
  issueSessionToken,
  verifySessionToken,
  getSessionTtlSeconds
} from "@/lib/auth/jwt";
import { authCookieNames } from "@/lib/auth/cookies";
import type { AuthSession, PublicSession, SessionClaims } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import { isRole } from "@/lib/permissions/roles";

type SessionTokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type RotatedSession = {
  session: PublicSession;
  tokens: SessionTokenPair;
};

export class InvalidRefreshSessionError extends Error {
  constructor() {
    super("Refresh session is invalid or expired.");
    this.name = "InvalidRefreshSessionError";
  }
}

export class RefreshSessionConflictError extends Error {
  constructor() {
    super("Refresh session rotation is already in progress.");
    this.name = "RefreshSessionConflictError";
  }
}

const refreshConflictWindowMs = 5_000;

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

async function issueSessionTokens(session: AuthSession): Promise<SessionTokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    issueSessionToken(session, "access"),
    issueSessionToken(session, "refresh")
  ]);

  return {
    accessToken,
    refreshToken
  };
}

function applySessionCookies(response: NextResponse, tokens: SessionTokenPair): NextResponse {
  response.cookies.set(authCookieNames.access, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds("access")
  });
  response.cookies.set(authCookieNames.refresh, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getSessionTtlSeconds("refresh")
  });
  response.cookies.set(authCookieNames.refreshRetry, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
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
  } catch (error) {
    if (error instanceof InvalidSessionTokenError) {
      return null;
    }

    throw error;
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
  const tokens = await issueSessionTokens(session);

  if (session.sessionId) {
    await prisma.authSession.update({
      where: {
        id: session.sessionId
      },
      data: {
        refreshTokenHash: hashToken(tokens.refreshToken),
        status: "active",
        expiresAt: new Date(Date.now() + getSessionTtlSeconds("refresh") * 1000),
        revokedAt: null
      }
    });
  }

  return applySessionCookies(response, tokens);
}

export function setRotatedSessionCookies(response: NextResponse, rotation: RotatedSession): NextResponse {
  return applySessionCookies(response, rotation.tokens);
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
  response.cookies.set(authCookieNames.refreshRetry, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}

export async function rotateSessionFromToken(refreshToken: string): Promise<RotatedSession> {
  let claims: SessionClaims;

  try {
    claims = await verifySessionToken(refreshToken, "refresh");
  } catch (error) {
    if (error instanceof InvalidSessionTokenError) {
      throw new InvalidRefreshSessionError();
    }

    throw error;
  }

  const sessionId = claims.sessionId;

  if (!sessionId) {
    throw new InvalidRefreshSessionError();
  }

  const authSession = await prisma.authSession.findUnique({
    where: {
      id: sessionId
    },
    include: {
      user: true
    }
  });

  const now = new Date();
  const currentRefreshTokenHash = hashToken(refreshToken);

  if (
    !authSession ||
    authSession.status !== "active" ||
    authSession.expiresAt <= now ||
    authSession.refreshTokenHash !== currentRefreshTokenHash ||
    authSession.user.status !== "active" ||
    authSession.userId !== claims.userId ||
    authSession.user.id !== claims.userId ||
    authSession.user.lineUserId !== claims.lineUserId ||
    claims.sub !== claims.userId ||
    !isRole(authSession.user.role)
  ) {
    throw new InvalidRefreshSessionError();
  }

  const session: PublicSession = {
    userId: authSession.user.id,
    lineUserId: authSession.user.lineUserId,
    role: authSession.user.role,
    sessionId: authSession.id,
    displayName: authSession.user.displayName ?? undefined,
    pictureUrl: authSession.user.avatarUrl ?? undefined,
    expiresAt: new Date(now.getTime() + getSessionTtlSeconds("access") * 1000).toISOString()
  };
  const tokens = await issueSessionTokens(session);
  const rotation = await prisma.authSession.updateMany({
    where: {
      id: authSession.id,
      userId: claims.userId,
      refreshTokenHash: currentRefreshTokenHash,
      status: "active",
      expiresAt: {
        gt: now
      },
      user: {
        is: {
          id: claims.userId,
          lineUserId: authSession.user.lineUserId,
          status: "active",
          role: authSession.user.role
        }
      }
    },
    data: {
      refreshTokenHash: hashToken(tokens.refreshToken),
      expiresAt: new Date(now.getTime() + getSessionTtlSeconds("refresh") * 1000),
      revokedAt: null
    }
  });

  if (rotation.count !== 1) {
    const currentSession = await prisma.authSession.findUnique({
      where: {
        id: authSession.id
      },
      include: {
        user: {
          select: {
            id: true,
            lineUserId: true,
            role: true,
            status: true,
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });

    if (
      currentSession &&
      currentSession.status === "active" &&
      currentSession.expiresAt > now &&
      currentSession.userId === claims.userId &&
      currentSession.user.id === claims.userId &&
      currentSession.user.lineUserId === claims.lineUserId &&
      currentSession.user.status === "active" &&
      currentSession.user.role === authSession.user.role &&
      currentSession.refreshTokenHash !== currentRefreshTokenHash &&
      currentSession.updatedAt.getTime() >= now.getTime() - refreshConflictWindowMs
    ) {
      throw new RefreshSessionConflictError();
    }

    throw new InvalidRefreshSessionError();
  }

  return {
    session,
    tokens
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
