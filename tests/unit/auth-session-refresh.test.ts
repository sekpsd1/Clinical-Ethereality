import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class InvalidSessionTokenError extends Error {}

  return {
    InvalidSessionTokenError,
    authSessionFindUnique: vi.fn(),
    authSessionUpdate: vi.fn(),
    authSessionUpdateMany: vi.fn(),
    cookies: vi.fn(),
    getSessionTtlSeconds: vi.fn((tokenType: "access" | "refresh") =>
      tokenType === "access" ? 15 * 60 : 30 * 24 * 60 * 60
    ),
    issueSessionToken: vi.fn(),
    verifySessionToken: vi.fn()
  };
});

vi.mock("next/headers", () => ({
  cookies: mocks.cookies
}));

vi.mock("@/lib/auth/jwt", () => ({
  InvalidSessionTokenError: mocks.InvalidSessionTokenError,
  getSessionTtlSeconds: mocks.getSessionTtlSeconds,
  issueSessionToken: mocks.issueSessionToken,
  verifySessionToken: mocks.verifySessionToken
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    authSession: {
      findUnique: mocks.authSessionFindUnique,
      update: mocks.authSessionUpdate,
      updateMany: mocks.authSessionUpdateMany
    }
  }
}));

import {
  getCurrentSession,
  InvalidRefreshSessionError,
  RefreshSessionConflictError,
  rotateSessionFromToken,
  setRotatedSessionCookies
} from "@/lib/auth/session";

const now = new Date("2026-07-31T10:00:00.000Z");
const oldRefreshToken = "old-refresh-token";
const oldRefreshTokenHash = createHash("sha256").update(oldRefreshToken).digest("hex");
const newRefreshTokenHash = createHash("sha256").update("new-refresh-token").digest("hex");

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    lineUserId: "line-1",
    role: "customer",
    sessionId: "session-1",
    tokenType: "refresh",
    iss: "clinical-ethereality",
    sub: "user-1",
    iat: 1,
    exp: 2,
    jti: "old-jti",
    ...overrides
  };
}

function validRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    userId: "user-1",
    refreshTokenHash: oldRefreshTokenHash,
    status: "active",
    expiresAt: new Date(now.getTime() + 60_000),
    updatedAt: now,
    user: {
      id: "user-1",
      lineUserId: "line-1",
      role: "doctor",
      status: "active",
      displayName: "Doctor Local",
      avatarUrl: null
    },
    ...overrides
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  mocks.verifySessionToken.mockResolvedValue(validClaims());
  mocks.authSessionFindUnique.mockResolvedValue(validRecord());
  mocks.issueSessionToken.mockImplementation(async (_session, tokenType: "access" | "refresh") =>
    tokenType === "access" ? "new-access-token" : "new-refresh-token"
  );
  mocks.authSessionUpdateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("refresh session rotation", () => {
  it("returns no current session only for an invalid access token", async () => {
    mocks.cookies.mockResolvedValueOnce({
      get: () => ({ value: "invalid-access" })
    });
    mocks.verifySessionToken.mockRejectedValueOnce(new mocks.InvalidSessionTokenError());

    await expect(getCurrentSession()).resolves.toBeNull();
  });

  it("propagates a current-session verifier outage instead of starting re-authentication", async () => {
    mocks.cookies.mockResolvedValueOnce({
      get: () => ({ value: "valid-looking-access" })
    });
    mocks.verifySessionToken.mockRejectedValueOnce(new Error("JWT configuration unavailable"));

    await expect(getCurrentSession()).rejects.toThrow("JWT configuration unavailable");
  });

  it("uses the current database role and rotates the refresh hash with compare-and-swap", async () => {
    const rotation = await rotateSessionFromToken(oldRefreshToken);

    expect(rotation.session).toMatchObject({
      userId: "user-1",
      lineUserId: "line-1",
      role: "doctor",
      sessionId: "session-1"
    });
    expect(rotation.tokens).toEqual({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token"
    });
    expect(mocks.issueSessionToken).toHaveBeenCalledWith(expect.objectContaining({ role: "doctor" }), "access");
    expect(mocks.authSessionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "session-1",
        userId: "user-1",
        refreshTokenHash: oldRefreshTokenHash,
        status: "active",
        expiresAt: {
          gt: now
        },
        user: {
          is: {
            id: "user-1",
            lineUserId: "line-1",
            status: "active",
            role: "doctor"
          }
        }
      },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: null
      }
    });
  });

  it("applies the rotated cookies with the unchanged access and refresh TTL values", async () => {
    const rotation = await rotateSessionFromToken(oldRefreshToken);
    const response = setRotatedSessionCookies(NextResponse.json({ ok: true }), rotation);

    expect(response.cookies.get("ce_access_token")?.value).toBe("new-access-token");
    expect(response.cookies.get("ce_refresh_token")?.value).toBe("new-refresh-token");
    expect(mocks.getSessionTtlSeconds).toHaveBeenCalledWith("access");
    expect(mocks.getSessionTtlSeconds).toHaveBeenCalledWith("refresh");
  });

  it.each([
    ["revoked session", { status: "revoked" }],
    ["expired session", { expiresAt: new Date(now.getTime() - 1) }],
    ["replayed token hash", { refreshTokenHash: "different-hash" }],
    ["different user", { userId: "other-user" }]
  ])("rejects a %s", async (_label, recordOverrides) => {
    mocks.authSessionFindUnique.mockResolvedValueOnce(validRecord(recordOverrides));

    await expect(rotateSessionFromToken(oldRefreshToken)).rejects.toBeInstanceOf(InvalidRefreshSessionError);
    expect(mocks.authSessionUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["inactive user", { status: "suspended" }],
    ["different LINE identity", { lineUserId: "other-line" }]
  ])("rejects an active session with an %s", async (_label, userOverrides) => {
    mocks.authSessionFindUnique.mockResolvedValueOnce(
      validRecord({
        user: {
          ...validRecord().user,
          ...userOverrides
        }
      })
    );

    await expect(rotateSessionFromToken(oldRefreshToken)).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it("rejects malformed, expired, or unsigned refresh JWTs as invalid sessions", async () => {
    mocks.verifySessionToken.mockRejectedValueOnce(new mocks.InvalidSessionTokenError());

    await expect(rotateSessionFromToken("invalid-refresh")).rejects.toBeInstanceOf(InvalidRefreshSessionError);
    expect(mocks.authSessionFindUnique).not.toHaveBeenCalled();
  });

  it("rejects the concurrent or replayed request that loses the rotation CAS", async () => {
    mocks.authSessionUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(rotateSessionFromToken(oldRefreshToken)).rejects.toBeInstanceOf(InvalidRefreshSessionError);
  });

  it("separates a concurrent rotation conflict from a later replay", async () => {
    mocks.authSessionFindUnique
      .mockResolvedValueOnce(validRecord())
      .mockResolvedValueOnce(validRecord({ refreshTokenHash: newRefreshTokenHash, updatedAt: now }));
    mocks.authSessionUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(rotateSessionFromToken(oldRefreshToken)).rejects.toBeInstanceOf(RefreshSessionConflictError);
  });

  it("does not disguise a verifier or configuration outage as an invalid refresh token", async () => {
    mocks.verifySessionToken.mockRejectedValueOnce(new Error("JWT verifier unavailable"));

    await expect(rotateSessionFromToken(oldRefreshToken)).rejects.toThrow("JWT verifier unavailable");
    expect(mocks.authSessionFindUnique).not.toHaveBeenCalled();
  });

  it("does not disguise a database outage as an invalid refresh token", async () => {
    mocks.authSessionFindUnique.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(rotateSessionFromToken(oldRefreshToken)).rejects.toThrow("database unavailable");
    await expect(rotateSessionFromToken(oldRefreshToken)).resolves.toBeDefined();
  });
});
