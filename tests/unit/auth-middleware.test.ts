import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/permissions/roles";

const mocks = vi.hoisted(() => {
  class InvalidAccessTokenError extends Error {}
  class InvalidRefreshSessionError extends Error {}
  class RefreshSessionConflictError extends Error {}

  return {
    InvalidAccessTokenError,
    InvalidRefreshSessionError,
    RefreshSessionConflictError,
    rotateSessionFromToken: vi.fn(),
    setRotatedSessionCookies: vi.fn(),
    verifyAccessTokenAtEdge: vi.fn()
  };
});

vi.mock("@/lib/auth/edge-jwt", () => ({
  InvalidAccessTokenError: mocks.InvalidAccessTokenError,
  verifyAccessTokenAtEdge: mocks.verifyAccessTokenAtEdge
}));

vi.mock("@/lib/auth/line-oauth", () => ({
  getPublicAppOrigin: (fallbackOrigin: string) => fallbackOrigin
}));

vi.mock("@/lib/auth/session", () => ({
  InvalidRefreshSessionError: mocks.InvalidRefreshSessionError,
  RefreshSessionConflictError: mocks.RefreshSessionConflictError,
  rotateSessionFromToken: mocks.rotateSessionFromToken,
  setRotatedSessionCookies: mocks.setRotatedSessionCookies
}));

import { middleware } from "@/middleware";

type RequestTokens = {
  access?: string;
  refresh?: string;
  retry?: string;
};

function createRequest(path: string, tokens: RequestTokens = {}): NextRequest {
  const cookie = [
    tokens.access ? `ce_access_token=${tokens.access}` : null,
    tokens.refresh ? `ce_refresh_token=${tokens.refresh}` : null,
    tokens.retry ? `ce_refresh_retry=${tokens.retry}` : null
  ]
    .filter(Boolean)
    .join("; ");

  return new NextRequest(`https://app.example${path}`, {
    headers: cookie ? { cookie } : undefined
  });
}

function createRotation(role: Role) {
  return {
    session: {
      userId: `${role}-user`,
      lineUserId: `${role}-line`,
      role,
      sessionId: `${role}-session`
    },
    tokens: {
      accessToken: `${role}-new-access`,
      refreshToken: `${role}-new-refresh`
    }
  };
}

function validAccessClaims(role: Role) {
  return {
    userId: `${role}-user`,
    lineUserId: `${role}-line`,
    role,
    tokenType: "access" as const,
    iss: "clinical-ethereality",
    sub: `${role}-user`,
    iat: 1,
    exp: 2
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.setRotatedSessionCookies.mockImplementation((response: NextResponse, rotation: ReturnType<typeof createRotation>) => {
    response.cookies.set("ce_access_token", rotation.tokens.accessToken, { path: "/" });
    response.cookies.set("ce_refresh_token", rotation.tokens.refreshToken, { path: "/" });
    return response;
  });
});

describe("protected-route transparent session refresh", () => {
  it.each([
    ["customer", "/profile/settings?section=account&from=refresh"],
    ["doctor", "/doctor/notifications?filter=unread&tag=a&tag=b"],
    ["pharmacist", "/pharmacist/prescriptions?status=pending&from=refresh"],
    ["admin", "/admin/payments?status=pending&from=refresh"]
  ] as const)("rotates an expired %s session and returns to the exact URL", async (role, path) => {
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockResolvedValueOnce(createRotation(role));

    const response = await middleware(createRequest(path, { access: "expired-access", refresh: "valid-refresh" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://app.example${path}`);
    expect(response.cookies.get("ce_access_token")?.value).toBe(`${role}-new-access`);
    expect(response.cookies.get("ce_refresh_token")?.value).toBe(`${role}-new-refresh`);
    expect(mocks.rotateSessionFromToken).toHaveBeenCalledWith("valid-refresh");
  });

  it("refreshes when the expired access cookie is no longer sent by the browser", async () => {
    mocks.rotateSessionFromToken.mockResolvedValueOnce(createRotation("doctor"));

    const response = await middleware(createRequest("/doctor/notifications?from=missing-access", { refresh: "valid-refresh" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example/doctor/notifications?from=missing-access");
    expect(mocks.verifyAccessTokenAtEdge).not.toHaveBeenCalled();
  });

  it.each([
    ["customer", "/profile?from=invalid-refresh"],
    ["doctor", "/doctor/notifications?from=invalid-refresh"],
    ["pharmacist", "/pharmacist/prescriptions?from=invalid-refresh"],
    ["admin", "/admin?from=invalid-refresh"]
  ] as const)("sends %s to LINE only when refresh is invalid", async (_role, path) => {
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.InvalidRefreshSessionError());

    const response = await middleware(createRequest(path, { access: "expired-access", refresh: "invalid-refresh" }));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/auth/line");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it("sends a missing refresh token to LINE with the full return path", async () => {
    const path = "/admin/payments?status=pending&reviewer=me";
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());

    const response = await middleware(createRequest(path, { access: "expired-access" }));
    const location = new URL(response.headers.get("location") ?? "");

    expect(location.pathname).toBe("/auth/line");
    expect(location.searchParams.get("next")).toBe(path);
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
  });

  it.each([
    ["customer", "/admin/users", "/consult/assessment"],
    ["doctor", "/pharmacist/prescriptions", "/doctor/consultations"],
    ["pharmacist", "/doctor/consultations", "/pharmacist/prescriptions"]
  ] as const)("routes a valid %s session away from a mismatched staff boundary", async (role, path, home) => {
    mocks.verifyAccessTokenAtEdge.mockResolvedValueOnce(validAccessClaims(role));

    const response = await middleware(createRequest(path, { access: "valid-access", refresh: "valid-refresh" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://app.example${home}`);
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
  });

  it("rotates before sending a refreshed mismatched role to its own home", async () => {
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockResolvedValueOnce(createRotation("doctor"));

    const response = await middleware(
      createRequest("/pharmacist/prescriptions?from=doctor", { access: "expired-access", refresh: "valid-refresh" })
    );

    expect(response.headers.get("location")).toBe("https://app.example/doctor/consultations");
    expect(response.cookies.get("ce_refresh_token")?.value).toBe("doctor-new-refresh");
  });

  it("keeps Admin support access to Doctor and Pharmacist routes", async () => {
    mocks.verifyAccessTokenAtEdge.mockResolvedValue(validAccessClaims("admin"));

    for (const path of ["/admin", "/doctor/consultations", "/pharmacist/prescriptions"]) {
      const response = await middleware(createRequest(path, { access: "valid-access" }));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("forwards the exact protected URL to server-side role guards", async () => {
    const path = "/admin/payments?status=pending&reviewer=me";
    mocks.verifyAccessTokenAtEdge.mockResolvedValueOnce(validAccessClaims("admin"));

    const response = await middleware(createRequest(path, { access: "valid-access" }));

    expect(response.headers.get("x-middleware-request-x-clinical-auth-return-path")).toBe(path);
  });

  it("refreshes once, then accepts the rotated access token without a redirect loop", async () => {
    const path = "/doctor/notifications?from=loop-check";
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockResolvedValueOnce(createRotation("doctor"));

    const firstResponse = await middleware(createRequest(path, { access: "expired-access", refresh: "valid-refresh" }));
    expect(firstResponse.headers.get("location")).toBe(`https://app.example${path}`);

    mocks.verifyAccessTokenAtEdge.mockResolvedValueOnce(validAccessClaims("doctor"));
    const secondResponse = await middleware(
      createRequest(path, { access: "doctor-new-access", refresh: "doctor-new-refresh" })
    );

    expect(secondResponse.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.rotateSessionFromToken).toHaveBeenCalledTimes(1);
  });

  it("does not disguise an unexpected refresh service failure as a LINE login", async () => {
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      middleware(createRequest("/doctor/notifications", { access: "expired-access", refresh: "valid-refresh" }))
    ).rejects.toThrow("database unavailable");
  });

  it("retries the original URL once instead of showing LINE during a concurrent rotation", async () => {
    const path = "/doctor/notifications?from=concurrent-refresh";
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.RefreshSessionConflictError());

    const response = await middleware(createRequest(path, { access: "expired-access", refresh: "valid-refresh" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://app.example${path}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.cookies.get("ce_refresh_retry")?.value).toBe("1");
  });

  it("keeps a known concurrent loser away from LINE while waiting for the winner cookie", async () => {
    const path = "/doctor/notifications?from=concurrent-retry";
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.InvalidRefreshSessionError());

    const response = await middleware(
      createRequest(path, { access: "expired-access", refresh: "already-rotated-refresh", retry: "1" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://app.example${path}`);
    expect(response.cookies.get("ce_refresh_retry")?.value).toBe("2");
  });

  it("ends a failed concurrent synchronization without LINE or a redirect loop", async () => {
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new mocks.InvalidAccessTokenError());
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.InvalidRefreshSessionError());

    const response = await middleware(
      createRequest("/doctor/notifications", {
        access: "expired-access",
        refresh: "already-rotated-refresh",
        retry: "3"
      })
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("retry-after")).toBe("1");
  });

  it("propagates an operational access verifier failure instead of treating it as expiry", async () => {
    mocks.verifyAccessTokenAtEdge.mockRejectedValueOnce(new Error("edge verifier unavailable"));

    await expect(
      middleware(createRequest("/doctor/notifications", { access: "valid-looking-access", refresh: "refresh" }))
    ).rejects.toThrow("edge verifier unavailable");
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
  });

  it("does not protect the LINE auth route itself", async () => {
    const response = await middleware(createRequest("/auth/line?next=%2Fdoctor%2Fnotifications"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.verifyAccessTokenAtEdge).not.toHaveBeenCalled();
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
  });
});
