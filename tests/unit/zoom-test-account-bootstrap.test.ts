/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";

const {
  AUDIT_ACTION,
  CUSTOMER_DATE_OF_BIRTH,
  CUSTOMER_FULL_NAME,
  CUSTOMER_PHONE,
  DOCTOR_BIO,
  DOCTOR_FULL_NAME,
  DOCTOR_SPECIALTY,
  FAILURE_CODES,
  VERSION,
  getNormalizedPhone,
  getTargetFingerprint,
  parseBootstrapOptions,
  resolveCandidates,
  runBootstrap,
  writeSafeFailure
} = require("../../scripts/zoom-test-account-bootstrap.cjs");
const {
  RunnerFailure,
  getDatabaseIdentityHash,
  sha256
} = require("../../scripts/zoom-test-fixture-runner.cjs");

const databaseIdentityHash = getDatabaseIdentityHash(
  "clinical_ethereality_uat",
  "clinical_uat@localhost"
);
const customerId = "zoom-test-customer";
const doctorId = "zoom-test-doctor";
const fingerprint = getTargetFingerprint(databaseIdentityHash, customerId, doctorId);
const appliedAt = new Date("2030-01-01T01:02:03.000Z");

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    CE_DEPLOYMENT_ENVIRONMENT: "test",
    NEXT_PUBLIC_APP_URL: "https://test-app.bccgroup-thailand.com",
    DATABASE_URL: "mysql://redacted-test-database",
    ENABLE_DEV_AUTH_BYPASS: "false",
    JWT_SECRET: "test-jwt-secret-at-least-thirty-two-characters",
    JWT_ISSUER: "clinical-ethereality-test",
    NEXT_PUBLIC_LINE_LIFF_ID: "test-liff",
    LINE_CHANNEL_ID: "test-line-channel",
    LINE_CHANNEL_SECRET: "test-line-secret",
    LINE_LOGIN_CALLBACK_URL: "https://test-app.bccgroup-thailand.com/api/auth/line/callback",
    ZOOM_TEST_LINE_CREDENTIALS_CONFIRMED: "true",
    ZOOM_TEST_DATABASE_IDENTITY_SHA256: databaseIdentityHash,
    ZOOM_TEST_CUSTOMER_USER_ID_SHA256: sha256(customerId),
    ZOOM_TEST_DOCTOR_USER_ID_SHA256: sha256(doctorId),
    ENABLE_PATIENT_PORTAL: "false",
    ENABLE_ONLINE_BOOKING: "false",
    ENABLE_PAYMENTS: "false",
    ENABLE_AI_FEATURES: "false",
    ENABLE_COMMUNITY: "false",
    ENABLE_PRESCRIPTIONS: "false",
    ...overrides
  };
}

function argumentsFor(mode: string, target = fingerprint) {
  const args = ["--mode=" + mode, "--confirm-test"];
  if (mode !== "precheck") args.push("--target-fingerprint=" + target);
  return args;
}

function options(mode: string) {
  return parseBootstrapOptions(argumentsFor(mode), environment());
}

function emptyUser(id: string) {
  return {
    id,
    lineUserId: "line-backed-" + id,
    fullName: null,
    dateOfBirth: null,
    email: null,
    phone: null,
    normalizedPhone: null,
    phoneVerifiedAt: null,
    phoneOtpDispatchClaimedUntil: null,
    rewardBalance: 0,
    role: "customer",
    status: "active",
    doctorProfile: null,
    pharmacistProfile: null
  };
}

function metadata(accountType: string) {
  return {
    accountType,
    controlled: true,
    fingerprint,
    runner: VERSION,
    testOnly: true
  };
}

function replayState() {
  const customer = emptyUser(customerId);
  Object.assign(customer, {
    fullName: CUSTOMER_FULL_NAME,
    dateOfBirth: CUSTOMER_DATE_OF_BIRTH,
    phone: CUSTOMER_PHONE,
    normalizedPhone: getNormalizedPhone(customerId),
    phoneVerifiedAt: appliedAt
  });
  const doctor = emptyUser(doctorId);
  Object.assign(doctor, {
    role: "doctor",
    fullName: DOCTOR_FULL_NAME,
    doctorProfile: {
      id: "synthetic-doctor-profile",
      userId: doctorId,
      licenseNumber: null,
      specialty: DOCTOR_SPECIALTY,
      bio: DOCTOR_BIO,
      consultationFee: 0,
      status: "approved",
      approvedAt: appliedAt,
      createdAt: appliedAt,
      updatedAt: appliedAt
    }
  });
  const audits = [
    {
      actorId: null,
      action: AUDIT_ACTION,
      entityType: "User",
      entityId: customerId,
      metadataJson: metadata("customer"),
      createdAt: appliedAt
    },
    {
      actorId: null,
      action: AUDIT_ACTION,
      entityType: "User",
      entityId: doctorId,
      metadataJson: metadata("doctor"),
      createdAt: appliedAt
    }
  ];
  return { users: [customer, doctor], audits };
}

function mockPrisma(replay = false) {
  const state: { users: any[]; audits: any[]; businessCount: number } = replay
    ? { ...replayState(), businessCount: 0 }
    : { users: [emptyUser(customerId), emptyUser(doctorId)], audits: [], businessCount: 0 };
  const prisma: any = {
    user: {
      findMany: vi.fn(async () => state.users),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const user = state.users.find((candidate) => candidate.id === where.id);
        if (!user || user.role !== where.role || user.fullName !== null) return { count: 0 };
        Object.assign(user, data);
        return { count: 1 };
      })
    },
    doctor: {
      create: vi.fn(async ({ data }: any) => {
        const user = state.users.find((candidate) => candidate.id === data.userId);
        user.doctorProfile = { id: "synthetic-doctor-profile", ...data };
        return user.doctorProfile;
      })
    },
    auditLog: {
      findMany: vi.fn(async () => state.audits),
      create: vi.fn(async ({ data }: any) => {
        state.audits.push(data);
        return data;
      })
    },
    consultation: { count: vi.fn(async () => state.businessCount) },
    payment: { count: vi.fn(async () => state.businessCount) },
    order: { count: vi.fn(async () => state.businessCount) },
    prescription: { count: vi.fn(async () => state.businessCount) },
    notification: { count: vi.fn(async () => state.businessCount) }
  };
  prisma.$transaction = vi.fn(async (callback: (tx: any) => unknown) => callback(prisma));
  return { prisma, state };
}

function getFailure(callback: () => unknown) {
  try {
    callback();
    throw new Error("Expected RunnerFailure");
  } catch (error) {
    if (!(error instanceof RunnerFailure)) throw error;
    const runnerFailure = error as { code: string; stage: string };
    return { code: runnerFailure.code, stage: runnerFailure.stage };
  }
}

describe("Zoom Test LINE account bootstrap environment gates", () => {
  it("requires explicit Test confirmation and a fingerprint for apply/verify", () => {
    expect(options("precheck")).toMatchObject({ mode: "precheck", targetFingerprint: null });
    expect(options("apply")).toMatchObject({ mode: "apply", targetFingerprint: fingerprint });
    expect(getFailure(() => parseBootstrapOptions(["--mode=precheck"], environment()))).toEqual({
      code: FAILURE_CODES.CONFIRM_TEST_REQUIRED,
      stage: "environment"
    });
    expect(
      getFailure(() => parseBootstrapOptions(["--mode=apply", "--confirm-test"], environment()))
    ).toEqual({ code: FAILURE_CODES.TARGET_FINGERPRINT_MISMATCH, stage: "target" });
  });

  it("fails closed outside the exact isolated Test boundary", () => {
    const cases = [
      { NODE_ENV: "test" },
      { CE_DEPLOYMENT_ENVIRONMENT: "production" },
      { NEXT_PUBLIC_APP_URL: "https://app.bccgroup-thailand.com" },
      { ENABLE_DEV_AUTH_BYPASS: "true" },
      { JWT_ISSUER: "clinical-ethereality" },
      { LINE_LOGIN_CALLBACK_URL: "https://example.test/callback" },
      { ZOOM_TEST_LINE_CREDENTIALS_CONFIRMED: "false" },
      { ENABLE_PAYMENTS: "true" },
      { SMS_OTP_PROVIDER: "provider" },
      { PLESK_MIGRATION_TARGET: "present" }
    ];
    for (const overrides of cases) {
      expect(() => parseBootstrapOptions(argumentsFor("precheck"), environment(overrides))).toThrow(
        RunnerFailure
      );
    }
  });
});

describe("Zoom Test LINE account bootstrap behavior", () => {
  it("prechecks exactly two hashed LINE-backed empty accounts without mutation", async () => {
    const { prisma } = mockPrisma();
    const result = await runBootstrap(prisma, options("precheck"), databaseIdentityHash, appliedAt);
    expect(result).toMatchObject({
      status: "ok",
      mode: "precheck",
      accountState: "eligible",
      fingerprint,
      replayed: false,
      counts: { accounts: 2, audits: 0 }
    });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.doctor.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects ambiguous hashes, profile drift, and existing business records", async () => {
    const ambiguous = mockPrisma();
    ambiguous.state.users.push({ ...emptyUser(customerId) });
    await expect(
      resolveCandidates(ambiguous.prisma, options("precheck"), databaseIdentityHash)
    ).rejects.toMatchObject({ code: FAILURE_CODES.TARGET_NOT_FOUND_OR_AMBIGUOUS });

    const drifted = mockPrisma();
    drifted.state.users[0].phone = "real-looking-state";
    await expect(runBootstrap(drifted.prisma, options("precheck"), databaseIdentityHash)).rejects.toMatchObject({
      code: FAILURE_CODES.TARGET_STATE_INVALID
    });

    const related = mockPrisma();
    related.state.businessCount = 1;
    await expect(runBootstrap(related.prisma, options("precheck"), databaseIdentityHash)).rejects.toMatchObject({
      code: FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED
    });
  });

  it("applies synthetic state and two provenance audits in one Serializable transaction", async () => {
    const { prisma, state } = mockPrisma();
    const result = await runBootstrap(prisma, options("apply"), databaseIdentityHash, appliedAt);
    expect(result).toMatchObject({ mode: "apply", fingerprint, replayed: false });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 30_000
    });
    expect(state.users[0]).toMatchObject({
      fullName: CUSTOMER_FULL_NAME,
      phone: CUSTOMER_PHONE,
      normalizedPhone: getNormalizedPhone(customerId),
      phoneVerifiedAt: appliedAt
    });
    expect(state.users[1]).toMatchObject({ role: "doctor", fullName: DOCTOR_FULL_NAME });
    expect(state.users[1].doctorProfile).toMatchObject({
      licenseNumber: null,
      specialty: DOCTOR_SPECIALTY,
      consultationFee: 0,
      status: "approved"
    });
    expect(state.audits).toHaveLength(2);
  });

  it("allows exact idempotent replay and rejects altered audit provenance", async () => {
    const exact = mockPrisma(true);
    await expect(
      runBootstrap(exact.prisma, options("apply"), databaseIdentityHash, appliedAt)
    ).resolves.toMatchObject({ mode: "apply", replayed: true });
    expect(exact.prisma.user.updateMany).not.toHaveBeenCalled();

    const verify = mockPrisma(true);
    await expect(
      runBootstrap(verify.prisma, options("verify"), databaseIdentityHash, appliedAt)
    ).resolves.toMatchObject({ mode: "verify", replayed: true });

    const altered = mockPrisma(true);
    altered.state.audits[0].metadataJson.controlled = false;
    await expect(
      runBootstrap(altered.prisma, options("verify"), databaseIdentityHash, appliedAt)
    ).rejects.toMatchObject({ code: FAILURE_CODES.TARGET_STATE_INVALID });
  });

  it("emits only allowlisted failure fields", () => {
    const output: string[] = [];
    const secret = "line-secret-and-database-url";
    writeSafeFailure(new Error(secret), argumentsFor("apply"), (line: string) => output.push(line));
    expect(JSON.parse(output[0])).toEqual({
      status: "error",
      code: FAILURE_CODES.UNKNOWN_SAFE_FAILURE,
      mode: "apply",
      stage: "unknown"
    });
    expect(output[0]).not.toContain(secret);
  });
});
