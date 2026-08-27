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
import { classifySmsOtpDatabaseError } from "@/lib/sms/otp";

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

  it.each([
    ["user_lookup", "userFindUnique", "P2021", "table_missing"],
    ["phone_owner_lookup", "userFindFirst", "P2022", "column_missing"],
    ["latest_challenge_lookup", "challengeFindFirst", "P1001", "connection_unavailable"],
    ["request_count_lookup", "challengeCount", "P1008", "timeout"]
  ] as const)(
    "records only the allowlisted %s preflight component and never calls the provider",
    async (component, mockName, code, databaseErrorCategory) => {
      const rawError = Object.assign(new Error("phone=0812345678 password=must-not-log"), { code });
      mocks[mockName].mockRejectedValue(rawError);
      const diagnosticLogger = vi.fn();

      await expect(
        requestPatientPhoneVerification(
          "customer-secret-id",
          {
            fullName: "patient-name-must-not-log",
            dateOfBirth: "1990-01-02",
            phone: "0812345678"
          },
          { diagnosticLogger }
        )
      ).rejects.toBe(rawError);

      expect(mocks.requestSmsOtp).not.toHaveBeenCalled();
      expect(diagnosticLogger).toHaveBeenCalledTimes(1);
      expect(diagnosticLogger).toHaveBeenCalledWith({
        stage: "request_preflight",
        preflightComponent: component,
        databaseErrorCategory,
        applicationHttpStatus: 503,
        providerHttpStatus: null,
        providerErrorCode: null,
        providerErrorCategory: "not_applicable"
      });
      const serializedDiagnostics = JSON.stringify(diagnosticLogger.mock.calls);
      for (const forbidden of [
        "customer-secret-id",
        "must-not-log",
        "patient-name",
        "0812345678",
        "1990-01-02"
      ]) {
        expect(serializedDiagnostics).not.toContain(forbidden);
      }
    }
  );

  it("selects simultaneous rejected preflight checks in a fixed component order", async () => {
    mocks.userFindUnique.mockRejectedValue(Object.assign(new Error("first raw error"), { code: "P2021" }));
    mocks.userFindFirst.mockRejectedValue(Object.assign(new Error("second raw error"), { code: "P2022" }));
    const diagnosticLogger = vi.fn();

    await expect(
      requestPatientPhoneVerification(
        "customer-1",
        { fullName: "Test Patient", dateOfBirth: "1990-01-02", phone: "0812345678" },
        { diagnosticLogger }
      )
    ).rejects.toThrow("first raw error");

    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userFindFirst).toHaveBeenCalledTimes(1);
    expect(diagnosticLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        preflightComponent: "user_lookup",
        databaseErrorCategory: "table_missing"
      })
    );
    expect(mocks.requestSmsOtp).not.toHaveBeenCalled();
  });

  it.each([
    [Object.assign(new Error("raw"), { code: "P2021" }), "table_missing"],
    [Object.assign(new Error("raw"), { code: "P2022" }), "column_missing"],
    [Object.assign(new Error("raw"), { code: "P1017" }), "connection_unavailable"],
    [Object.assign(new Error("raw"), { code: "P2024" }), "timeout"],
    [Object.assign(new Error("raw"), { code: "P2002" }), "query_rejected"],
    [new Error("raw"), "unknown"]
  ] as const)("classifies a database failure as the closed enum %s", (error, expected) => {
    expect(classifySmsOtpDatabaseError(error)).toBe(expected);
  });
});
