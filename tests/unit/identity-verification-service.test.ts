import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  challengeCount: vi.fn(),
  challengeFindFirst: vi.fn(),
  requestSmsOtp: vi.fn(),
  transaction: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: mocks.userFindFirst,
      findUnique: mocks.userFindUnique
    },
    phoneVerificationChallenge: {
      count: mocks.challengeCount,
      findFirst: mocks.challengeFindFirst
    },
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/env/schema", () => ({
  getAppEnv: () => ({
    SMS_OTP_PROVIDER: "thaibulksms",
    SMS_OTP_API_KEY: "configured",
    SMS_OTP_API_SECRET: "configured",
    SMS_OTP_CHALLENGE_ENCRYPTION_KEY: "x".repeat(64)
  })
}));

vi.mock("@/lib/sms/otp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sms/otp")>();
  return {
    ...actual,
    getSmsOtpReadiness: () => ({ isConfigured: true }),
    requestSmsOtp: mocks.requestSmsOtp
  };
});

import { requestPatientPhoneVerification } from "@/features/identity-verification/service";

describe("patient phone verification diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue({ normalizedPhone: null, phoneVerifiedAt: null });
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.challengeFindFirst.mockResolvedValue(null);
    mocks.challengeCount.mockResolvedValue(0);
    mocks.requestSmsOtp.mockResolvedValue({
      provider: "thaibulksms",
      providerChallengeId: "provider-token-must-not-log",
      reference: "provider-refno-must-not-log",
      phoneLabel: "masked-phone-must-not-log"
    });
  });

  it("classifies an unexpected persistence error without logging raw error or patient/provider data", async () => {
    mocks.transaction.mockRejectedValue(new Error("database password=must-not-log"));
    const diagnosticLogger = vi.fn();

    await expect(
      requestPatientPhoneVerification(
        "customer-1",
        {
          fullName: "patient-name-must-not-log",
          dateOfBirth: "1990-01-02",
          phone: "0812345678"
        },
        { diagnosticLogger }
      )
    ).rejects.toThrow("database password=must-not-log");

    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(diagnosticLogger).toHaveBeenCalledWith({
      stage: "request_persistence",
      applicationHttpStatus: 503,
      providerHttpStatus: null,
      providerErrorCode: null,
      providerErrorCategory: "not_applicable"
    });
    const serializedDiagnostics = JSON.stringify(diagnosticLogger.mock.calls);
    for (const forbidden of [
      "must-not-log",
      "patient-name",
      "0812345678",
      "1990-01-02",
      "provider-token",
      "provider-refno",
      "masked-phone"
    ]) {
      expect(serializedDiagnostics).not.toContain(forbidden);
    }
  });
});
