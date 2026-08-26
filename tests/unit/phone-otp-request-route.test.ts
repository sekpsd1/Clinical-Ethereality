import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertRole: vi.fn(),
  requestPatientPhoneVerification: vi.fn(),
  requireCurrentSession: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentSession: mocks.requireCurrentSession
}));

vi.mock("@/lib/permissions", () => ({
  assertRole: mocks.assertRole
}));

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

describe("phone OTP request route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
  });

  it("returns schema HTTP 400 before provider or persistence work and logs only safe diagnostics", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      createRequest({
        fullName: "",
        dateOfBirth: "not-a-date",
        phone: "secret-phone-value"
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.requestPatientPhoneVerification).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[sms/otp] failed", {
      stage: "request_schema",
      applicationHttpStatus: 400,
      providerHttpStatus: null,
      providerErrorCode: null,
      providerErrorCategory: "not_applicable"
    });
    const serializedDiagnostics = JSON.stringify(consoleError.mock.calls);
    expect(serializedDiagnostics).not.toContain("secret-phone-value");
    expect(serializedDiagnostics).not.toContain("not-a-date");

    consoleError.mockRestore();
  });
});
