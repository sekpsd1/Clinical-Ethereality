/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";

const {
  PRECHECK_FAILURE_CODES,
  getSafeFailure,
  parsePrecheckOptions,
  runDatabasePrecheck,
  writeSafeFailure
} = require("../../scripts/zoom-test-db-precheck.cjs");
const {
  RunnerFailure,
  getDatabaseIdentityHash
} = require("../../scripts/zoom-test-fixture-runner.cjs");

const databaseName = "clinical_ethereality_uat";
const databaseUser = "clinical_uat@localhost";
const databaseIdentityHash = getDatabaseIdentityHash(databaseName, databaseUser);

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    CE_DEPLOYMENT_ENVIRONMENT: "test",
    NEXT_PUBLIC_APP_URL: "https://test-app.bccgroup-thailand.com",
    ENABLE_DEV_AUTH_BYPASS: "false",
    DATABASE_URL: "mysql://redacted-test-database",
    ZOOM_TEST_DATABASE_IDENTITY_SHA256: databaseIdentityHash,
    ...overrides
  };
}

function failure(callback: () => unknown) {
  try {
    callback();
    throw new Error("Expected RunnerFailure");
  } catch (error) {
    if (!(error instanceof RunnerFailure)) throw error;
    const runnerFailure = error as { code: string; stage: string };
    return { code: runnerFailure.code, stage: runnerFailure.stage };
  }
}

describe("Zoom Test database pre-migration guard", () => {
  it("accepts only the exact Test boundary and explicit confirmation", () => {
    expect(parsePrecheckOptions(["--confirm-test"], environment())).toEqual({
      databaseIdentityHash
    });
    expect(failure(() => parsePrecheckOptions([], environment()))).toEqual({
      code: PRECHECK_FAILURE_CODES.CONFIRM_TEST_REQUIRED,
      stage: "environment"
    });
    expect(failure(() => parsePrecheckOptions(["--confirm-test", "--extra"], environment()))).toEqual({
      code: PRECHECK_FAILURE_CODES.INVALID_ARGUMENT,
      stage: "arguments"
    });
  });

  it("rejects Production-like environment state and migration targets before database access", () => {
    const cases = [
      { NODE_ENV: "test" },
      { CE_DEPLOYMENT_ENVIRONMENT: "production" },
      { NEXT_PUBLIC_APP_URL: "https://app.bccgroup-thailand.com" },
      { ENABLE_DEV_AUTH_BYPASS: "true" },
      { DATABASE_URL: "" },
      { ZOOM_TEST_DATABASE_IDENTITY_SHA256: "not-a-hash" },
      { PLESK_MIGRATION_TARGET: "anything" }
    ];
    for (const overrides of cases) {
      expect(() => parsePrecheckOptions(["--confirm-test"], environment(overrides))).toThrow(
        RunnerFailure
      );
    }
  });

  it("queries only the database identity and returns allowlisted output", async () => {
    const query = vi.fn(async () => [{ databaseName, databaseUser }]);
    const result = await runDatabasePrecheck(
      { $queryRawUnsafe: query },
      { databaseIdentityHash }
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      "SELECT DATABASE() AS databaseName, CURRENT_USER() AS databaseUser"
    );
    expect(result).toEqual({
      status: "ok",
      mode: "precheck",
      stage: "complete",
      databaseIdentity: "matched"
    });
  });

  it("never serializes database or error details", () => {
    const lines: string[] = [];
    const secret = "mysql://secret@prod-host/prod";
    writeSafeFailure(new Error(secret), (line: string) => lines.push(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(secret);
    expect(JSON.parse(lines[0])).toEqual({
      status: "error",
      code: PRECHECK_FAILURE_CODES.UNKNOWN_SAFE_FAILURE,
      mode: "precheck",
      stage: "unknown"
    });
  });

  it("classifies Prisma initialization errorCode values without serializing details", () => {
    expect(getSafeFailure({ errorCode: "P1000", message: "hidden" })).toEqual({
      code: PRECHECK_FAILURE_CODES.DATABASE_AUTHENTICATION_FAILED,
      stage: "database"
    });
    expect(getSafeFailure({ errorCode: "P1010", message: "hidden" })).toEqual({
      code: PRECHECK_FAILURE_CODES.DATABASE_ACCESS_DENIED,
      stage: "database"
    });
    expect(getSafeFailure({ errorCode: "P1011", message: "hidden" })).toEqual({
      code: PRECHECK_FAILURE_CODES.DATABASE_TLS_FAILED,
      stage: "database"
    });
    expect(getSafeFailure({
      name: "PrismaClientInitializationError",
      message: "Error loading shared library libssl"
    })).toEqual({
      code: PRECHECK_FAILURE_CODES.DATABASE_ENGINE_UNAVAILABLE,
      stage: "database"
    });
    expect(getSafeFailure({
      name: "PrismaClientUnknownRequestError",
      message: "hidden"
    })).toEqual({
      code: PRECHECK_FAILURE_CODES.DATABASE_QUERY_FAILED,
      stage: "database"
    });
  });
});
