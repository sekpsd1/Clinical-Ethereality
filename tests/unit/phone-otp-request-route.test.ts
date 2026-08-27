import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SmsOtpDiagnosticLogger } from "@/lib/sms/otp";

const mocks = vi.hoisted(() => {
  class InvalidRefreshSessionError extends Error {}
  class RefreshSessionConflictError extends Error {}

  return {
    InvalidRefreshSessionError,
    RefreshSessionConflictError,
    assertRole: vi.fn(),
    getCurrentSession: vi.fn(),
    requestPatientPhoneVerification: vi.fn(),
    rotateSessionFromToken: vi.fn(),
    setRotatedSessionCookies: vi.fn(),
    writeSmsOtpDiagnostic: vi.fn(),
    writeSmsOtpRouteStatus: vi.fn()
  };
});

vi.mock("@/lib/auth/session", () => ({
  InvalidRefreshSessionError: mocks.InvalidRefreshSessionError,
  RefreshSessionConflictError: mocks.RefreshSessionConflictError,
  getCurrentSession: mocks.getCurrentSession,
  rotateSessionFromToken: mocks.rotateSessionFromToken,
  setRotatedSessionCookies: mocks.setRotatedSessionCookies
}));

vi.mock("@/lib/permissions", () => ({
  assertRole: mocks.assertRole
}));

vi.mock("@/lib/sms/otp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sms/otp")>();
  return {
    ...actual,
    writeSmsOtpDiagnostic: mocks.writeSmsOtpDiagnostic,
    writeSmsOtpRouteStatus: mocks.writeSmsOtpRouteStatus
  };
});

vi.mock("@/features/identity-verification/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/identity-verification/service")>();
  return {
    ...actual,
    requestPatientPhoneVerification: mocks.requestPatientPhoneVerification
  };
});

import { POST } from "@/app/api/identity/phone-otp/request/route";

function createRequest(
  body: Record<string, unknown>,
  cookies: { access?: string; refresh?: string } = {}
) {
  const cookie = [
    cookies.access ? `ce_access_token=${cookies.access}` : null,
    cookies.refresh ? `ce_refresh_token=${cookies.refresh}` : null
  ]
    .filter(Boolean)
    .join("; ");

  return new NextRequest("http://localhost/api/identity/phone-otp/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(body)
  });
}

const validBody = {
  fullName: "Test Customer",
  dateOfBirth: "2000-01-01",
  phone: "0812345678"
};

const refreshedSession = {
  session: {
    userId: "customer-1",
    lineUserId: "line-customer-1",
    role: "customer" as const,
    sessionId: "session-1"
  },
  tokens: {
    accessToken: "rotated-access-token",
    refreshToken: "rotated-refresh-token"
  }
};

function expectRouteFailure(routeComponent: string, applicationHttpStatus: number) {
  expect(mocks.writeSmsOtpRouteStatus).toHaveBeenLastCalledWith({
    routeComponent,
    status: "failed",
    applicationHttpStatus
  });
}

describe("phone OTP request route", () => {
  beforeEach(() => {
    mocks.assertRole.mockReset();
    mocks.getCurrentSession.mockReset();
    mocks.requestPatientPhoneVerification.mockReset();
    mocks.rotateSessionFromToken.mockReset();
    mocks.setRotatedSessionCookies.mockReset();
    mocks.writeSmsOtpDiagnostic.mockReset();
    mocks.writeSmsOtpRouteStatus.mockReset();
    mocks.getCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.rotateSessionFromToken.mockResolvedValue(refreshedSession);
    mocks.setRotatedSessionCookies.mockImplementation((response: NextResponse) => response);
    mocks.requestPatientPhoneVerification.mockResolvedValue({
      challengeId: "challenge-1",
      phoneLabel: "safe-label",
      expiresAt: "2026-08-27T02:00:00.000Z"
    });
  });

  it("records a schema failure without persisting request PII", async () => {
    const response = await POST(
      createRequest({
        fullName: "",
        dateOfBirth: "not-a-date",
        phone: "secret-phone-value"
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expectRouteFailure("request_schema", 400);
    const serializedDiagnostics = JSON.stringify(mocks.writeSmsOtpRouteStatus.mock.calls);
    expect(serializedDiagnostics).not.toContain("secret-phone-value");
    expect(serializedDiagnostics).not.toContain("not-a-date");
  });

  it("records the exact route component when session lookup has an operational failure", async () => {
    mocks.getCurrentSession.mockRejectedValue(new Error("private session detail"));

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(503);
    expect(mocks.assertRole).not.toHaveBeenCalled();
    expectRouteFailure("session_lookup", 503);
    expect(JSON.stringify(mocks.writeSmsOtpRouteStatus.mock.calls)).not.toContain("private session detail");
  });

  it("keeps a valid access session unchanged without unnecessary refresh", async () => {
    const response = await POST(createRequest(validBody, { access: "valid-access" }));

    expect(response.status).toBe(200);
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
    expect(mocks.setRotatedSessionCookies).not.toHaveBeenCalled();
    expect(mocks.requestPatientPhoneVerification).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["expired or invalid access", { access: "expired-access", refresh: "valid-refresh" }],
    ["missing access", { refresh: "valid-refresh" }]
  ])("restores an %s session before dispatching exactly once", async (_label, cookies) => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);

    const response = await POST(createRequest(validBody, cookies));

    expect(response.status).toBe(200);
    expect(mocks.rotateSessionFromToken).toHaveBeenCalledTimes(1);
    expect(mocks.rotateSessionFromToken).toHaveBeenCalledWith("valid-refresh");
    expect(mocks.setRotatedSessionCookies).toHaveBeenCalledWith(expect.anything(), refreshedSession);
    expect(mocks.assertRole).toHaveBeenCalledTimes(1);
    expect(mocks.requestPatientPhoneVerification).toHaveBeenCalledTimes(1);
  });

  it("fails closed with 401 when the refresh cookie is missing", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, message: "กรุณาเข้าสู่ระบบอีกครั้ง" });
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
    expect(mocks.assertRole).not.toHaveBeenCalled();
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expectRouteFailure("session_lookup", 401);
  });

  it.each(["invalid", "expired", "revoked"])(
    "fails closed with 401 when the refresh session is %s",
    async () => {
      mocks.getCurrentSession.mockResolvedValueOnce(null);
      mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.InvalidRefreshSessionError());

      const response = await POST(createRequest(validBody, { refresh: "private-refresh-token" }));

      expect(response.status).toBe(401);
      expect(mocks.assertRole).not.toHaveBeenCalled();
      expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
      expectRouteFailure("session_lookup", 401);
      expect(JSON.stringify(mocks.writeSmsOtpRouteStatus.mock.calls)).not.toContain("private-refresh-token");
    }
  );

  it("fails closed on a concurrent refresh without dispatching the service", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new mocks.RefreshSessionConflictError());

    const response = await POST(createRequest(validBody, { refresh: "concurrent-refresh" }));

    expect(response.status).toBe(409);
    expect(mocks.assertRole).not.toHaveBeenCalled();
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expectRouteFailure("session_lookup", 409);
  });

  it("keeps an unexpected refresh failure private and stops before service dispatch", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    mocks.rotateSessionFromToken.mockRejectedValueOnce(new Error("private refresh database detail"));

    const response = await POST(createRequest(validBody, { refresh: "private-refresh-token" }));

    expect(response.status).toBe(503);
    expect(mocks.assertRole).not.toHaveBeenCalled();
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expectRouteFailure("session_lookup", 503);
    const serializedDiagnostics = JSON.stringify(mocks.writeSmsOtpRouteStatus.mock.calls);
    expect(serializedDiagnostics).not.toContain("private refresh database detail");
    expect(serializedDiagnostics).not.toContain("private-refresh-token");
  });

  it("enforces the customer role after a successful refresh", async () => {
    mocks.getCurrentSession.mockResolvedValueOnce(null);
    mocks.rotateSessionFromToken.mockResolvedValueOnce({
      ...refreshedSession,
      session: { ...refreshedSession.session, role: "doctor" as const }
    });
    mocks.assertRole.mockImplementationOnce(() => {
      throw new Error("private role detail");
    });

    const response = await POST(createRequest(validBody, { refresh: "valid-refresh" }));

    expect(response.status).toBe(503);
    expect(mocks.assertRole).toHaveBeenCalledWith(expect.objectContaining({ role: "doctor" }), ["customer"]);
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expectRouteFailure("role_check", 503);
  });

  it("records the exact route component when the role check fails", async () => {
    mocks.assertRole.mockImplementation(() => {
      throw new Error("private role detail");
    });

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(503);
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expectRouteFailure("role_check", 503);
  });

  it("distinguishes an unreadable request body from schema validation", async () => {
    const request = new NextRequest("http://localhost/api/identity/phone-otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json"
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expectRouteFailure("request_body", 400);
  });

  it("records service dispatch when no component-specific diagnostic exists", async () => {
    mocks.requestPatientPhoneVerification.mockRejectedValue(new Error("private service detail"));

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(503);
    expectRouteFailure("service_dispatch", 503);
    expect(JSON.stringify(mocks.writeSmsOtpRouteStatus.mock.calls)).not.toContain("private service detail");
  });

  it("does not overwrite a more specific service diagnostic", async () => {
    const serviceDiagnostic = {
      stage: "request_preflight" as const,
      preflightComponent: "user_lookup" as const,
      databaseErrorCategory: "connection_unavailable" as const,
      applicationHttpStatus: 503 as const,
      providerHttpStatus: null,
      providerErrorCode: null,
      providerErrorCategory: "not_applicable" as const
    };
    mocks.requestPatientPhoneVerification.mockImplementation(
      async (
        _userId: string,
        _input: unknown,
        options: { diagnosticLogger: SmsOtpDiagnosticLogger }
      ) => {
        options.diagnosticLogger(serviceDiagnostic);
        throw new Error("private database detail");
      }
    );

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(503);
    expect(mocks.writeSmsOtpDiagnostic).toHaveBeenCalledWith(serviceDiagnostic);
    expect(mocks.writeSmsOtpRouteStatus).toHaveBeenLastCalledWith({
      routeComponent: "service_dispatch",
      status: "started"
    });
    expect(mocks.writeSmsOtpRouteStatus).not.toHaveBeenCalledWith({
      routeComponent: "service_dispatch",
      status: "failed",
      applicationHttpStatus: 503
    });
  });

  it("records the fixed route order on success", async () => {
    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(200);
    expect(mocks.rotateSessionFromToken).not.toHaveBeenCalled();
    expect(mocks.writeSmsOtpRouteStatus.mock.calls.map(([event]) => event)).toEqual([
      { routeComponent: "session_lookup", status: "started" },
      { routeComponent: "session_lookup", status: "ready" },
      { routeComponent: "role_check", status: "started" },
      { routeComponent: "role_check", status: "ready" },
      { routeComponent: "request_body", status: "started" },
      { routeComponent: "request_body", status: "ready" },
      { routeComponent: "request_schema", status: "started" },
      { routeComponent: "request_schema", status: "ready" },
      { routeComponent: "service_dispatch", status: "started" },
      { routeComponent: "service_dispatch", status: "ready" }
    ]);
  });
});
