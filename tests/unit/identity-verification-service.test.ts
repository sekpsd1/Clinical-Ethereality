import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  challengeCount: vi.fn(),
  challengeCreate: vi.fn(),
  challengeFindFirst: vi.fn(),
  challengeUpdateMany: vi.fn(),
  requestSmsOtp: vi.fn(),
  transaction: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  userUpdateMany: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAuditLog: mocks.writeAuditLog
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: mocks.userFindFirst,
      findUnique: mocks.userFindUnique,
      updateMany: mocks.userUpdateMany
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
import {
  classifySmsOtpDatabaseError,
  SmsOtpError,
  type SmsOtpSafeDiagnostic
} from "@/lib/sms/otp";

type ClaimState = {
  get: () => Date | null;
};

function configureAtomicClaim(initial: Date | null = null): ClaimState {
  let claimedUntil = initial;

  mocks.userUpdateMany.mockImplementation(async (args: {
    where: Record<string, unknown> & {
      OR?: Array<Record<string, unknown>>;
      phoneOtpDispatchClaimedUntil?: Date;
    };
    data: { phoneOtpDispatchClaimedUntil: Date | null };
  }) => {
    if (args.data.phoneOtpDispatchClaimedUntil === null) {
      const expected = args.where.phoneOtpDispatchClaimedUntil;
      if (claimedUntil && expected && claimedUntil.getTime() === expected.getTime()) {
        claimedUntil = null;
        return { count: 1 };
      }
      return { count: 0 };
    }

    const staleBefore = (
      args.where.OR?.[1]?.phoneOtpDispatchClaimedUntil as { lte?: Date } | undefined
    )?.lte;
    if (!claimedUntil || (staleBefore && claimedUntil <= staleBefore)) {
      claimedUntil = args.data.phoneOtpDispatchClaimedUntil;
      return { count: 1 };
    }
    return { count: 0 };
  });

  return { get: () => claimedUntil };
}

function providerDiagnostic(
  providerHttpStatus: number | null,
  providerErrorCategory: SmsOtpSafeDiagnostic["providerErrorCategory"]
): SmsOtpSafeDiagnostic {
  return {
    stage: "request_provider",
    applicationHttpStatus: providerHttpStatus === null || providerHttpStatus >= 500 ? 503 : 400,
    providerHttpStatus,
    providerErrorCode: null,
    providerErrorCategory
  };
}

describe("patient phone verification diagnostics", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T04:00:00.000Z"));
    mocks.userFindUnique.mockResolvedValue({ normalizedPhone: null, phoneVerifiedAt: null });
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.challengeFindFirst.mockResolvedValue(null);
    mocks.challengeCount.mockResolvedValue(0);
    mocks.challengeUpdateMany.mockResolvedValue({ count: 0 });
    mocks.userUpdate.mockResolvedValue({});
    mocks.challengeCreate.mockResolvedValue({ id: "challenge-1" });
    configureAtomicClaim();
    mocks.transaction.mockImplementation(async (operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        phoneVerificationChallenge: {
          create: mocks.challengeCreate,
          updateMany: mocks.challengeUpdateMany
        },
        user: { update: mocks.userUpdate }
      })
    );
    mocks.requestSmsOtp.mockResolvedValue({
      provider: "thaibulksms",
      providerChallengeId: "provider-token-must-not-log",
      reference: "provider-refno-must-not-log",
      phoneLabel: "masked-phone-must-not-log"
    });
  });

  it("allows only one provider dispatch for two concurrent requests", async () => {
    let resolveProvider: ((value: {
      provider: "thaibulksms";
      providerChallengeId: string;
      reference: string;
      phoneLabel: string;
    }) => void) | undefined;
    mocks.requestSmsOtp.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProvider = resolve;
        })
    );

    const input = { fullName: "Test Patient", dateOfBirth: "1990-01-02", phone: "0812345678" };
    const first = requestPatientPhoneVerification("customer-1", input);
    const second = requestPatientPhoneVerification("customer-1", input);

    await expect(second).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(1);

    resolveProvider?.({
      provider: "thaibulksms",
      providerChallengeId: "provider-token-must-not-log",
      reference: "provider-refno-must-not-log",
      phoneLabel: "masked-phone-must-not-log"
    });
    await expect(first).resolves.toMatchObject({ challengeId: "challenge-1" });
    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(1);
  });

  it("claims atomically and recovers an expired stale claim", async () => {
    const stale = new Date("2026-08-27T03:59:59.999Z");
    const claim = configureAtomicClaim(stale);

    await expect(
      requestPatientPhoneVerification("customer-1", {
        fullName: "Test Patient",
        dateOfBirth: "1990-01-02",
        phone: "0812345678"
      })
    ).resolves.toMatchObject({ challengeId: "challenge-1" });

    expect(claim.get()).toEqual(new Date("2026-08-27T04:01:00.000Z"));
    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "customer-1",
        OR: [
          { phoneOtpDispatchClaimedUntil: null },
          { phoneOtpDispatchClaimedUntil: { lte: new Date("2026-08-27T04:00:00.000Z") } }
        ]
      },
      data: { phoneOtpDispatchClaimedUntil: new Date("2026-08-27T04:01:00.000Z") }
    });
  });

  it("releases a definitively rejected provider claim for a controlled retry", async () => {
    const claim = configureAtomicClaim();
    mocks.requestSmsOtp.mockRejectedValueOnce(
      new SmsOtpError("PROVIDER_REJECTED", providerDiagnostic(400, "provider_rejected"))
    );
    const input = { fullName: "Test Patient", dateOfBirth: "1990-01-02", phone: "0812345678" };

    await expect(requestPatientPhoneVerification("customer-1", input)).rejects.toMatchObject({
      code: "OTP_REJECTED"
    });
    expect(claim.get()).toBeNull();

    await expect(requestPatientPhoneVerification("customer-1", input)).resolves.toMatchObject({
      challengeId: "challenge-1"
    });
    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(2);
  });

  it.each(["provider_timeout", "provider_network"] as const)(
    "retains an ambiguous %s claim until the cooldown expires",
    async (category) => {
    mocks.requestSmsOtp.mockRejectedValueOnce(
      new SmsOtpError("PROVIDER_UNAVAILABLE", providerDiagnostic(null, category))
    );
    const input = { fullName: "Test Patient", dateOfBirth: "1990-01-02", phone: "0812345678" };

    await expect(requestPatientPhoneVerification("customer-1", input)).rejects.toMatchObject({
      code: "OTP_UNAVAILABLE"
    });
    await expect(requestPatientPhoneVerification("customer-1", input)).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });
    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    await expect(requestPatientPhoneVerification("customer-1", input)).resolves.toMatchObject({
      challengeId: "challenge-1"
    });
    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(2);
    }
  );

  it("retains the claim after post-provider persistence failure", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("private persistence failure"));
    const input = { fullName: "Test Patient", dateOfBirth: "1990-01-02", phone: "0812345678" };

    await expect(requestPatientPhoneVerification("customer-1", input)).rejects.toThrow(
      "private persistence failure"
    );
    await expect(requestPatientPhoneVerification("customer-1", input)).rejects.toMatchObject({
      code: "RATE_LIMITED"
    });
    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    await expect(requestPatientPhoneVerification("customer-1", input)).resolves.toMatchObject({
      challengeId: "challenge-1"
    });
    expect(mocks.requestSmsOtp).toHaveBeenCalledTimes(2);
  });

  it("fails before the provider and emits only a safe dispatch-claim diagnostic", async () => {
    const rawError = Object.assign(new Error("phone=0812345678 password=must-not-log"), { code: "P2022" });
    mocks.userUpdateMany.mockRejectedValueOnce(rawError);
    const diagnosticLogger = vi.fn();

    await expect(
      requestPatientPhoneVerification(
        "customer-secret-id",
        { fullName: "patient-name-must-not-log", dateOfBirth: "1990-01-02", phone: "0812345678" },
        { diagnosticLogger }
      )
    ).rejects.toBe(rawError);

    expect(mocks.requestSmsOtp).not.toHaveBeenCalled();
    expect(diagnosticLogger).toHaveBeenCalledWith({
      stage: "request_preflight",
      preflightComponent: "dispatch_claim",
      databaseErrorCategory: "column_missing",
      applicationHttpStatus: 503,
      providerHttpStatus: null,
      providerErrorCode: null,
      providerErrorCategory: "not_applicable"
    });
    expect(JSON.stringify(diagnosticLogger.mock.calls)).not.toMatch(
      /0812345678|must-not-log|patient-name|customer-secret-id/
    );
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
