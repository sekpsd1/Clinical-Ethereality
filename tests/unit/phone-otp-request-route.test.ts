import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SmsOtpDiagnosticLogger } from "@/lib/sms/otp";

const mocks = vi.hoisted(() => ({
  assertRole: vi.fn(),
  requestPatientPhoneVerification: vi.fn(),
  requireCurrentSession: vi.fn(),
  writeSmsOtpDiagnostic: vi.fn(),
  writeSmsOtpRouteStatus: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession
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

function createRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/identity/phone-otp/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const validBody = {
  fullName: "Test Customer",
  dateOfBirth: "2000-01-01",
  phone: "0812345678"
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
    mocks.requestPatientPhoneVerification.mockReset();
    mocks.requireCurrentSession.mockReset();
    mocks.writeSmsOtpDiagnostic.mockReset();
    mocks.writeSmsOtpRouteStatus.mockReset();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
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

  it("records the exact route component when session lookup fails", async () => {
    mocks.requireCurrentSession.mockRejectedValue(new Error("private session detail"));

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(503);
    expect(mocks.assertRole).not.toHaveBeenCalled();
    expectRouteFailure("session_lookup", 503);
    expect(JSON.stringify(mocks.writeSmsOtpRouteStatus.mock.calls)).not.toContain("private session detail");
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
    const request = new Request("http://localhost/api/identity/phone-otp/request", {
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
