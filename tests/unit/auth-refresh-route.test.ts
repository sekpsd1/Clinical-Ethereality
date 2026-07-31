import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class InvalidRefreshSessionError extends Error {}
  class RefreshSessionConflictError extends Error {}

  return {
    InvalidRefreshSessionError,
    RefreshSessionConflictError,
    rotateSessionFromToken: vi.fn(),
    setRotatedSessionCookies: vi.fn()
  };
});

vi.mock("@/lib/auth/session", () => ({
  InvalidRefreshSessionError: mocks.InvalidRefreshSessionError,
  RefreshSessionConflictError: mocks.RefreshSessionConflictError,
  rotateSessionFromToken: mocks.rotateSessionFromToken,
  setRotatedSessionCookies: mocks.setRotatedSessionCookies
}));

import { POST } from "@/app/api/auth/refresh/route";

function createRequest(refreshToken?: string, retry?: string) {
  const cookie = [
    refreshToken ? `ce_refresh_token=${refreshToken}` : null,
    retry ? `ce_refresh_retry=${retry}` : null
  ]
    .filter(Boolean)
    .join("; ");

  return new NextRequest("https://app.example/api/auth/refresh", {
    method: "POST",
    headers: cookie ? { cookie } : undefined
  });
}

const rotation = {
  session: {
    userId: "doctor-user",
    lineUserId: "doctor-line",
    role: "doctor" as const,
    sessionId: "session-1",
    displayName: "Doctor Local"
  },
  tokens: {
    accessToken: "new-access",
    refreshToken: "new-refresh"
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setRotatedSessionCookies.mockImplementation((response: NextResponse) => response);
});

describe("POST /api/auth/refresh", () => {
  it("requires a refresh cookie", async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(401);
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
  });

  it("returns the current database-backed role and applies rotated cookies", async () => {
    mocks.rotateSessionFromToken.mockResolvedValueOnce(rotation);

    const response = await POST(createRequest("valid-refresh"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      session: {
        userId: "doctor-user",
        role: "doctor"
      }
    });
    expect(mocks.setRotatedSessionCookies).toHaveBeenCalledWith(expect.anything(), rotation);
  });

  it("returns 401 only for invalid, expired, revoked, or replayed refresh sessions", async () => {
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.InvalidRefreshSessionError());

    const response = await POST(createRequest("invalid-refresh"));

    expect(response.status).toBe(401);
  });

  it("returns 503 for an unexpected database or signing failure", async () => {
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await POST(createRequest("valid-refresh"));

    expect(response.status).toBe(503);
  });

  it("returns a retryable conflict instead of starting re-authentication during concurrent rotation", async () => {
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.RefreshSessionConflictError());

    const response = await POST(createRequest("concurrent-refresh"));

    expect(response.status).toBe(409);
    expect(response.headers.get("retry-after")).toBe("0");
    expect(response.cookies.get("ce_refresh_retry")?.value).toBe("1");
  });

  it("keeps a known concurrent loser retryable instead of returning invalid-session 401", async () => {
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.InvalidRefreshSessionError());

    const response = await POST(createRequest("already-rotated-refresh", "1"));

    expect(response.status).toBe(409);
    expect(response.cookies.get("ce_refresh_retry")?.value).toBe("2");
  });

  it("bounds API synchronization retries with 503 instead of LINE-triggering 401", async () => {
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.InvalidRefreshSessionError());

    const response = await POST(createRequest("already-rotated-refresh", "3"));

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("1");
  });
});
