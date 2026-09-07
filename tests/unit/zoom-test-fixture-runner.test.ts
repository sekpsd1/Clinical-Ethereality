/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const {
  FIXTURE_ACTION_CANCELLED,
  FIXTURE_ACTION_CREATED,
  REQUIRED_SCHEMA_COLUMNS,
  RUNNER_FAILURE_CODES,
  RunnerFailure,
  assertDatabaseIdentity,
  assertMigrationRows,
  assertSchemaColumns,
  getDatabaseIdentityHash,
  getFixtureSummary,
  getSourceMigrationNames,
  isTestOnlyDatabaseIdentity,
  parseRunnerOptions,
  resolveTarget,
  runTestFixtureRunner,
  sha256,
  writeSafeFailure
} = require("../../scripts/zoom-test-fixture-runner.cjs");

const scheduledIso = "2030-01-02T03:04:05.000Z";
const now = new Date("2030-01-01T00:00:00.000Z");
const databaseName = "clinical_ethereality_uat";
const databaseUser = "clinical_uat@localhost";
const databaseIdentityHash = getDatabaseIdentityHash(databaseName, databaseUser);
const customerId = "test-customer-user-id";
const doctorUserId = "test-doctor-user-id";

function baseEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    CE_DEPLOYMENT_ENVIRONMENT: "test",
    NEXT_PUBLIC_APP_URL: "https://test-app.bccgroup-thailand.com",
    DATABASE_URL: "mysql://test-user:test-password@test-host:3306/clinical_ethereality_uat",
    ENABLE_DEV_AUTH_BYPASS: "false",
    JWT_SECRET: "test-jwt-secret-at-least-thirty-two-characters",
    JWT_ISSUER: "clinical-ethereality-test",
    NEXT_PUBLIC_LINE_LIFF_ID: "test-liff",
    LINE_CHANNEL_ID: "test-line-channel",
    LINE_CHANNEL_SECRET: "test-line-secret",
    LINE_LOGIN_CALLBACK_URL: "https://test-app.bccgroup-thailand.com/api/auth/line/callback",
    ZOOM_MEETING_SDK_CLIENT_ID: "test-meeting-sdk-id",
    ZOOM_MEETING_SDK_CLIENT_SECRET: "test-meeting-sdk-secret",
    ZOOM_ACCOUNT_ID: "test-account-id",
    ZOOM_CLIENT_ID: "test-s2s-client-id",
    ZOOM_CLIENT_SECRET: "test-s2s-client-secret",
    ZOOM_HOST_USER_ID: "test-host",
    ZOOM_WEBHOOK_SECRET: "test-webhook-secret",
    ZOOM_TEST_WEBHOOK_URL: "https://test-app.bccgroup-thailand.com/api/webhooks/zoom",
    ENABLE_VIDEO_CONSULTATIONS: "true",
    ZOOM_TEST_LINE_CREDENTIALS_CONFIRMED: "true",
    ZOOM_TEST_ZOOM_CREDENTIALS_CONFIRMED: "true",
    ZOOM_TEST_DATABASE_IDENTITY_SHA256: databaseIdentityHash,
    ZOOM_TEST_CUSTOMER_USER_ID_SHA256: sha256(customerId),
    ZOOM_TEST_DOCTOR_USER_ID_SHA256: sha256(doctorUserId),
    ...overrides
  };
}

function args(mode = "precheck", extra: string[] = []) {
  return [
    "--mode=" + mode,
    "--confirm-test",
    "--fixture-key=zoom-test-20300102-a",
    "--scheduled-at=" + scheduledIso,
    ...extra
  ];
}

function getFailure(callback: () => unknown) {
  try {
    callback();
    throw new Error("Expected RunnerFailure.");
  } catch (error) {
    if (!(error instanceof RunnerFailure)) throw error;
    const failure = error as { code: string; stage: string };
    return { code: failure.code, stage: failure.stage };
  }
}

function customerRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: customerId,
    lineUserId: "test-line-customer",
    role: "customer",
    status: "active",
    fullName: "Synthetic Customer",
    dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
    phone: "test-phone",
    normalizedPhone: "test-normalized-phone",
    phoneVerifiedAt: new Date("2029-12-01T00:00:00.000Z"),
    ...overrides
  };
}

function doctorRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-doctor-profile-id",
    status: "approved",
    userId: doctorUserId,
    user: {
      id: doctorUserId,
      lineUserId: "test-line-doctor",
      role: "doctor",
      status: "active"
    },
    ...overrides
  };
}

function parseOptions(mode = "precheck", extra: string[] = [], parseNow = now) {
  return parseRunnerOptions(args(mode, extra), baseEnvironment(), parseNow);
}

function makeFixturePrisma() {
  const state: {
    fixture: null | Record<string, any>;
    audits: Array<{ action: string; metadataJson: Record<string, unknown> }>;
    paymentCount: number;
  } = { fixture: null, audits: [], paymentCount: 0 };

  const consultationCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    state.fixture = {
      ...data,
      id: "test-consultation-id",
      zoomMeetingId: null,
      zoomPassword: null,
      zoomJoinUrl: null
    };
    return state.fixture;
  });
  const consultationUpdateMany = vi.fn(async () => {
    if (!state.fixture) return { count: 0 };
    state.fixture.status = "cancelled";
    return { count: 1 };
  });
  const auditCreate = vi.fn(
    async ({ data }: { data: { action: string; metadataJson: Record<string, unknown> } }) => {
      state.audits.push({ action: data.action, metadataJson: data.metadataJson });
      return data;
    }
  );
  const prisma: Record<string, any> = {
    user: { findMany: vi.fn(async () => [customerRecord()]) },
    doctor: { findMany: vi.fn(async () => [doctorRecord()]) },
    consultation: {
      create: consultationCreate,
      findMany: vi.fn(async (query: { where: { summary?: string } }) =>
        query.where.summary ? (state.fixture ? [state.fixture] : []) : []
      ),
      updateMany: consultationUpdateMany
    },
    consultationSlotLock: { findFirst: vi.fn(async () => null) },
    payment: { count: vi.fn(async () => state.paymentCount) },
    fileAttachment: { count: vi.fn(async () => 0) },
    prescription: { count: vi.fn(async () => 0) },
    orderItem: { count: vi.fn(async () => 0) },
    auditLog: {
      create: auditCreate,
      findMany: vi.fn(async () => [...state.audits])
    }
  };
  prisma.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma));
  return { auditCreate, consultationCreate, consultationUpdateMany, prisma, state };
}

describe("Test-only Zoom fixture environment gates", () => {
  it("accepts only the exact Test boundary and explicit confirmation", () => {
    expect(parseOptions()).toMatchObject({
      mode: "precheck",
      fixtureKey: "zoom-test-20300102-a",
      targetFingerprint: null
    });
    expect(
      getFailure(() =>
        parseRunnerOptions(args().filter((value) => value !== "--confirm-test"), baseEnvironment(), now)
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.CONFIRM_TEST_REQUIRED, stage: "environment" });
    expect(
      getFailure(() => parseRunnerOptions(args(), baseEnvironment({ NODE_ENV: "test" }), now))
    ).toEqual({ code: RUNNER_FAILURE_CODES.ENVIRONMENT_NOT_PRODUCTION, stage: "environment" });
    expect(
      getFailure(() =>
        parseRunnerOptions(args(), baseEnvironment({ CE_DEPLOYMENT_ENVIRONMENT: "production" }), now)
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.DEPLOYMENT_MARKER_INVALID, stage: "environment" });
  });

  it("rejects Production and non-exact application origins before database access", () => {
    for (const appUrl of [
      "https://app.bccgroup-thailand.com",
      "https://test-app.bccgroup-thailand.com/",
      "http://test-app.bccgroup-thailand.com"
    ]) {
      expect(
        getFailure(() => parseRunnerOptions(args(), baseEnvironment({ NEXT_PUBLIC_APP_URL: appUrl }), now))
      ).toEqual({ code: RUNNER_FAILURE_CODES.APP_URL_NOT_TEST, stage: "environment" });
    }
    expect(
      getFailure(() => parseRunnerOptions(args(), baseEnvironment({ DATABASE_URL: "" }), now))
    ).toEqual({ code: RUNNER_FAILURE_CODES.DATABASE_CONFIG_NOT_READY, stage: "environment" });
  });

  it("requires disabled dev auth, Test JWT, exact Test LINE, and all Zoom keys", () => {
    expect(
      getFailure(() => parseRunnerOptions(args(), baseEnvironment({ ENABLE_DEV_AUTH_BYPASS: "true" }), now))
    ).toEqual({ code: RUNNER_FAILURE_CODES.DEV_AUTH_BYPASS_NOT_DISABLED, stage: "environment" });
    expect(
      getFailure(() => parseRunnerOptions(args(), baseEnvironment({ JWT_ISSUER: "clinical-ethereality" }), now))
    ).toEqual({ code: RUNNER_FAILURE_CODES.TEST_AUTH_CONFIG_NOT_READY, stage: "environment" });
    expect(
      getFailure(() =>
        parseRunnerOptions(
          args(),
          baseEnvironment({
            LINE_LOGIN_CALLBACK_URL: "https://app.bccgroup-thailand.com/api/auth/line/callback"
          }),
          now
        )
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.LINE_CONFIG_NOT_READY, stage: "environment" });
    expect(
      getFailure(() => parseRunnerOptions(args(), baseEnvironment({ ZOOM_HOST_USER_ID: "" }), now))
    ).toEqual({ code: RUNNER_FAILURE_CODES.ZOOM_CONFIG_NOT_READY, stage: "environment" });
    expect(
      getFailure(() =>
        parseRunnerOptions(
          args(),
          baseEnvironment({ ZOOM_TEST_WEBHOOK_URL: "https://app.bccgroup-thailand.com/api/webhooks/zoom" }),
          now
        )
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.ZOOM_CONFIG_NOT_READY, stage: "environment" });
  });

  it("requires credential confirmation and blocks migration targets and unrelated integrations", () => {
    expect(
      getFailure(() =>
        parseRunnerOptions(args(), baseEnvironment({ ZOOM_TEST_ZOOM_CREDENTIALS_CONFIRMED: "false" }), now)
      )
    ).toEqual({
      code: RUNNER_FAILURE_CODES.TEST_CREDENTIAL_CONFIRMATION_REQUIRED,
      stage: "environment"
    });
    expect(
      getFailure(() => parseRunnerOptions(args(), baseEnvironment({ PLESK_MIGRATION_TARGET: "" }), now))
    ).toEqual({ code: RUNNER_FAILURE_CODES.MIGRATION_TARGET_PRESENT, stage: "environment" });
    expect(
      getFailure(() => parseRunnerOptions(args(), baseEnvironment({ SMS_OTP_API_KEY: "configured" }), now))
    ).toEqual({ code: RUNNER_FAILURE_CODES.NONESSENTIAL_INTEGRATION_ENABLED, stage: "environment" });
  });

  it("rejects unknown arguments, invalid hashes, past slots, and distant slots", () => {
    expect(getFailure(() => parseRunnerOptions(args("precheck", ["--other=value"]), baseEnvironment(), now))).toEqual({
      code: RUNNER_FAILURE_CODES.INVALID_ARGUMENT,
      stage: "arguments"
    });
    expect(
      getFailure(() =>
        parseRunnerOptions(args(), baseEnvironment({ ZOOM_TEST_DATABASE_IDENTITY_SHA256: "bad" }), now)
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.DATABASE_IDENTITY_MISMATCH, stage: "environment" });
    expect(
      getFailure(() =>
        parseRunnerOptions(
          args().map((value) =>
            value.startsWith("--scheduled-at=") ? "--scheduled-at=2029-12-31T23:59:59.000Z" : value
          ),
          baseEnvironment(),
          now
        )
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.SLOT_NOT_FUTURE, stage: "slot" });
    expect(
      getFailure(() =>
        parseRunnerOptions(
          args().map((value) =>
            value.startsWith("--scheduled-at=") ? "--scheduled-at=2030-03-01T00:00:00.000Z" : value
          ),
          baseEnvironment(),
          now
        )
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.SLOT_TOO_FAR, stage: "slot" });
  });
});

describe("Test-only Zoom fixture database and schema gates", () => {
  it("requires a matched Test-looking database and dedicated Test user", async () => {
    expect(isTestOnlyDatabaseIdentity(databaseName, databaseUser)).toBe(true);
    expect(isTestOnlyDatabaseIdentity("bccgroup_app2026", "clinical_uat@localhost")).toBe(false);
    expect(isTestOnlyDatabaseIdentity(databaseName, "bccgroup@localhost")).toBe(false);
    await expect(
      assertDatabaseIdentity(
        { $queryRawUnsafe: vi.fn(async () => [{ databaseName, databaseUser }]) },
        databaseIdentityHash
      )
    ).resolves.toBe(databaseIdentityHash);
    await expect(
      assertDatabaseIdentity(
        { $queryRawUnsafe: vi.fn(async () => [{ databaseName: "bccgroup_app2026", databaseUser }]) },
        getDatabaseIdentityHash("bccgroup_app2026", databaseUser)
      )
    ).rejects.toMatchObject({ code: RUNNER_FAILURE_CODES.DATABASE_PROVENANCE_REJECTED });
    await expect(
      assertDatabaseIdentity(
        { $queryRawUnsafe: vi.fn(async () => [{ databaseName, databaseUser }]) },
        sha256("wrong")
      )
    ).rejects.toMatchObject({ code: RUNNER_FAILURE_CODES.DATABASE_IDENTITY_MISMATCH });
  });

  it("requires every source migration to be applied once and finished", () => {
    const names = ["20260101000000_init", "20260102000000_zoom"];
    const rows = names.map((migrationName) => ({
      migrationName,
      finishedAt: new Date(),
      rolledBackAt: null
    }));
    expect(() => assertMigrationRows(rows, names)).not.toThrow();
    expect(getFailure(() => assertMigrationRows(rows.slice(0, 1), names))).toEqual({
      code: RUNNER_FAILURE_CODES.SCHEMA_NOT_READY,
      stage: "schema"
    });
    expect(
      getFailure(() => assertMigrationRows([{ ...rows[0], finishedAt: null }, rows[1]], names))
    ).toEqual({ code: RUNNER_FAILURE_CODES.SCHEMA_NOT_READY, stage: "schema" });
  });

  it("requires every guarded schema column and discovers repository migrations", () => {
    const rows = Object.entries(REQUIRED_SCHEMA_COLUMNS).flatMap(([tableName, columns]) =>
      (columns as string[]).map((columnName) => ({ tableName, columnName }))
    );
    expect(() => assertSchemaColumns(rows)).not.toThrow();
    expect(getFailure(() => assertSchemaColumns(rows.slice(1)))).toEqual({
      code: RUNNER_FAILURE_CODES.SCHEMA_NOT_READY,
      stage: "schema"
    });
    expect(getSourceMigrationNames()).toContain("20260906120000_add_zoom_attendance_gate");
  });
});

describe("Test-only Zoom fixture account and mutation boundaries", () => {
  it("selects only the hashed LINE-backed verified Customer and approved Doctor", async () => {
    const options = parseOptions();
    const prisma = {
      user: { findMany: vi.fn(async () => [customerRecord(), customerRecord({ id: "other" })]) },
      doctor: { findMany: vi.fn(async () => [doctorRecord(), doctorRecord({ userId: "other-doctor" })]) }
    };
    await expect(resolveTarget(prisma, options)).resolves.toMatchObject({
      customer: { id: customerId },
      doctor: { userId: doctorUserId }
    });
    await expect(
      resolveTarget(
        {
          ...prisma,
          user: { findMany: vi.fn(async () => [customerRecord({ phoneVerifiedAt: null })]) }
        },
        options
      )
    ).rejects.toMatchObject({ code: RUNNER_FAILURE_CODES.CUSTOMER_INELIGIBLE });
  });

  it("creates only Consultation plus AuditLog and makes create replay idempotent", async () => {
    const harness = makeFixturePrisma();
    const precheck = await runTestFixtureRunner(harness.prisma, parseOptions(), databaseIdentityHash);
    const createOptions = parseOptions("create", ["--target-fingerprint=" + precheck.fingerprint]);
    const first = await runTestFixtureRunner(harness.prisma, createOptions, databaseIdentityHash);
    const replay = await runTestFixtureRunner(harness.prisma, createOptions, databaseIdentityHash);
    expect(first).toMatchObject({
      status: "ok",
      mode: "create",
      replayed: false,
      fixtureStatus: "scheduled",
      zoom: "absent",
      counts: { consultation: 1, audit: 1, payment: 0, prescription: 0, order: 0 }
    });
    expect(replay).toMatchObject({ status: "ok", mode: "create", replayed: true });
    expect(harness.consultationCreate).toHaveBeenCalledTimes(1);
    expect(harness.auditCreate).toHaveBeenCalledTimes(1);
    expect(harness.consultationCreate.mock.calls[0][0].data).toEqual({
      bookedDurationMinutes: 30,
      doctorId: "test-doctor-profile-id",
      patientId: customerId,
      scheduledAt: new Date(scheduledIso),
      status: "scheduled",
      summary: getFixtureSummary("zoom-test-20300102-a")
    });
  });

  it("fails closed on unexpected payment data before replay mutation", async () => {
    const harness = makeFixturePrisma();
    const precheck = await runTestFixtureRunner(harness.prisma, parseOptions(), databaseIdentityHash);
    const createOptions = parseOptions("create", ["--target-fingerprint=" + precheck.fingerprint]);
    await runTestFixtureRunner(harness.prisma, createOptions, databaseIdentityHash);
    harness.state.paymentCount = 1;
    await expect(
      runTestFixtureRunner(harness.prisma, createOptions, databaseIdentityHash)
    ).rejects.toMatchObject({ code: RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED });
    expect(harness.consultationCreate).toHaveBeenCalledTimes(1);
    expect(harness.auditCreate).toHaveBeenCalledTimes(1);
  });

  it("cancels non-destructively once and makes cleanup replay read-only", async () => {
    const harness = makeFixturePrisma();
    const precheck = await runTestFixtureRunner(harness.prisma, parseOptions(), databaseIdentityHash);
    const fingerprint = precheck.fingerprint;
    await runTestFixtureRunner(
      harness.prisma,
      parseOptions("create", ["--target-fingerprint=" + fingerprint]),
      databaseIdentityHash
    );
    Object.assign(harness.state.fixture!, {
      status: "live",
      zoomMeetingId: "provider-meeting-present",
      zoomPassword: "provider-password-present",
      zoomJoinUrl: "provider-join-url-present"
    });
    const cleanupOptions = parseOptions("cleanup", ["--target-fingerprint=" + fingerprint]);
    const first = await runTestFixtureRunner(harness.prisma, cleanupOptions, databaseIdentityHash);
    const replay = await runTestFixtureRunner(harness.prisma, cleanupOptions, databaseIdentityHash);
    expect(first).toMatchObject({
      status: "ok",
      mode: "cleanup",
      replayed: false,
      fixtureStatus: "cancelled",
      zoom: "present",
      counts: { audit: 2 }
    });
    expect(replay).toMatchObject({ status: "ok", mode: "cleanup", replayed: true });
    expect(harness.consultationUpdateMany).toHaveBeenCalledTimes(1);
    expect(harness.auditCreate).toHaveBeenCalledTimes(2);
    expect(harness.auditCreate.mock.calls[1][0].data.action).toBe(FIXTURE_ACTION_CANCELLED);
  });

  it("does not import or invoke payment, SMS, or Zoom creation code", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/zoom-test-fixture-runner.cjs"),
      "utf8"
    );
    expect(source).not.toMatch(/createZoomMeeting|lib[\\/]zoom[\\/]meetings/);
    expect(source).not.toMatch(/\.(?:payment|prescription|order|orderItem)\.create\s*\(/);
    expect(source).not.toMatch(/\.(?:attendanceCredential|attendanceEvent)\.create\s*\(/);
    expect(source).toContain(FIXTURE_ACTION_CREATED);
  });

  it("redacts raw failures, identifiers, labels, environment values, and secrets", () => {
    const output: string[] = [];
    writeSafeFailure(
      new Error("DATABASE_URL=mysql://secret LINE-user-id customer@example.com"),
      ["--mode=precheck", "--fixture-key=sensitive-label"],
      (value: string) => output.push(value)
    );
    expect(output).toEqual([
      JSON.stringify({
        status: "error",
        code: RUNNER_FAILURE_CODES.UNKNOWN_SAFE_FAILURE,
        mode: "precheck",
        stage: "unknown"
      })
    ]);
    expect(output[0]).not.toMatch(/secret|LINE-user|customer@|sensitive-label|DATABASE_URL/);
  });
});
