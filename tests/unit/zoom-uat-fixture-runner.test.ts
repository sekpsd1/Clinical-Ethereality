/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";

const {
  FIXTURE_DURATION_MINUTES,
  RUNNER_FAILURE_CODES,
  RunnerFailure,
  getSafeFailure,
  getFixtureSummary,
  getOverlap,
  getTargetFingerprint,
  maskIdentifier,
  parseRunnerOptions,
  resolveTarget,
  writeSafeFailure
} = require("../../scripts/zoom-uat-fixture-runner.cjs");

const futureIso = "2030-01-02T03:04:05.000Z";

function productionArgs(extra: string[] = []) {
  return [
    "--mode=precheck",
    "--confirm-production",
    "--fixture-key=zoom-uat-20300102-a",
    "--customer-label=sekmon",
    "--doctor-label=websthai",
    `--scheduled-at=${futureIso}`,
    ...extra
  ];
}

function getThrownFailure(callback: () => unknown) {
  try {
    callback();
  } catch (error) {
    return getSafeFailure(error);
  }
  throw new Error("Expected runner failure.");
}

describe("Zoom UAT fixture runner", () => {
  it("maps argument, confirmation, environment, and slot guards to allowlisted codes", () => {
    expect(getThrownFailure(() => parseRunnerOptions(productionArgs(), { NODE_ENV: "test" }))).toEqual({
      code: RUNNER_FAILURE_CODES.ENVIRONMENT_NOT_PRODUCTION,
      stage: "environment"
    });
    expect(
      getThrownFailure(() =>
        parseRunnerOptions(productionArgs().filter((argument) => argument !== "--confirm-production"), { NODE_ENV: "production" })
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.PRODUCTION_CONFIRMATION_REQUIRED, stage: "environment" });
    expect(getThrownFailure(() => parseRunnerOptions(productionArgs(["--customer-label=other"]), { NODE_ENV: "production" }))).toEqual({
      code: RUNNER_FAILURE_CODES.INVALID_ARGUMENT,
      stage: "arguments"
    });
    expect(
      getThrownFailure(() =>
        parseRunnerOptions(
        [
          "--mode=precheck",
          "--confirm-production",
          "--fixture-key=bad",
          "--customer-label=sekmon",
          "--doctor-label=websthai",
          `--scheduled-at=${futureIso}`
        ],
        { NODE_ENV: "production" }
        )
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.INVALID_ARGUMENT, stage: "arguments" });
    expect(
      getThrownFailure(() =>
        parseRunnerOptions(
          productionArgs().map((argument) =>
            argument.startsWith("--scheduled-at=") ? "--scheduled-at=2000-01-02T03:04:05.000Z" : argument
          ),
          { NODE_ENV: "production" }
        )
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.SLOT_NOT_FUTURE, stage: "slot" });
  });

  it("requires a fingerprint for every mutating or verification mode", () => {
    expect(() =>
      parseRunnerOptions(
        productionArgs().map((argument) => (argument === "--mode=precheck" ? "--mode=create" : argument)),
        { NODE_ENV: "production" }
      )
    ).toThrow();
    expect(
      getThrownFailure(() =>
        parseRunnerOptions(
          productionArgs().map((argument) => (argument === "--mode=precheck" ? "--mode=create" : argument)),
          { NODE_ENV: "production" }
        )
      )
    ).toEqual({ code: RUNNER_FAILURE_CODES.INVALID_ARGUMENT, stage: "arguments" });
  });

  it("uses a stable fingerprint and never emits the raw identifier", () => {
    const target = { customer: { id: "customer-internal-id" }, doctor: { id: "doctor-internal-id", userId: "doctor-user-id" } };
    const scheduledAt = new Date(futureIso);
    const fingerprint = getTargetFingerprint(target, "zoom-uat-20300102-a", scheduledAt);

    expect(fingerprint).toHaveLength(64);
    expect(maskIdentifier(target.customer.id)).not.toContain(target.customer.id);
    expect(getFixtureSummary("zoom-uat-20300102-a")).toContain("[UAT]");
  });

  it("detects only an actual interval overlap and rejects unsafe durations", () => {
    const scheduledAt = new Date(futureIso);
    expect(
      getOverlap(
        [
          {
            bookedDurationMinutes: FIXTURE_DURATION_MINUTES,
            scheduledAt: new Date(scheduledAt.getTime() - 15 * 60_000)
          }
        ],
        scheduledAt
      )
    ).not.toBeNull();
    expect(
      getOverlap(
        [
          {
            bookedDurationMinutes: FIXTURE_DURATION_MINUTES,
            scheduledAt: new Date(scheduledAt.getTime() - FIXTURE_DURATION_MINUTES * 60_000)
          }
        ],
        scheduledAt
      )
    ).toBeNull();
    expect(getThrownFailure(() => getOverlap([{ bookedDurationMinutes: 1000, scheduledAt }], scheduledAt))).toEqual({
      code: RUNNER_FAILURE_CODES.SLOT_OVERLAP,
      stage: "slot"
    });
  });

  it("classifies customer and doctor eligibility without returning identifiers", async () => {
    const options = parseRunnerOptions(productionArgs(), { NODE_ENV: "production" });
    const customerIneligiblePrisma = {
      doctor: { findMany: async () => [{ id: "doctor-1", userId: "doctor-user-1" }] },
      user: {
        findMany: async (query: { where: { role?: string } }) => (query.where.role ? [] : [{ id: "customer-secret-id" }])
      }
    };
    const doctorIneligiblePrisma = {
      doctor: {
        findMany: async (query: { where: { status?: string } }) => (query.where.status ? [] : [{ id: "doctor-secret-id" }])
      },
      user: { findMany: async () => [{ id: "customer-1" }] }
    };

    await expect(resolveTarget(customerIneligiblePrisma, options)).rejects.toMatchObject({
      code: RUNNER_FAILURE_CODES.CUSTOMER_INELIGIBLE,
      stage: "target"
    });
    await expect(resolveTarget(doctorIneligiblePrisma, options)).rejects.toMatchObject({
      code: RUNNER_FAILURE_CODES.DOCTOR_INELIGIBLE,
      stage: "target"
    });
  });

  it("preserves every explicit failure code and safe stage", () => {
    const expectedFailures = [
      [RUNNER_FAILURE_CODES.CUSTOMER_NOT_FOUND_OR_AMBIGUOUS, "target"],
      [RUNNER_FAILURE_CODES.DATABASE_UNAVAILABLE, "database"],
      [RUNNER_FAILURE_CODES.DOCTOR_NOT_FOUND_OR_AMBIGUOUS, "target"],
      [RUNNER_FAILURE_CODES.FIXTURE_KEY_CONFLICT, "fixture"],
      [RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "integrity"],
      [RUNNER_FAILURE_CODES.TARGET_FINGERPRINT_MISMATCH, "fixture"],
      [RUNNER_FAILURE_CODES.TRANSACTION_CONFLICT, "transaction"]
    ];

    for (const [code, stage] of expectedFailures) {
      expect(getSafeFailure(new RunnerFailure(code, stage))).toEqual({
        code,
        stage
      });
    }
    expect(getSafeFailure(new RunnerFailure(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "token=never-print"))).toEqual({
      code: RUNNER_FAILURE_CODES.INVALID_ARGUMENT,
      stage: "unknown"
    });
  });

  it("writes only allowlisted diagnostics for raw database and unknown errors", () => {
    const databaseError = Object.assign(new Error("password=never-print customer-secret-id"), { code: "P1001" });
    const unknownError = new Error("token=never-print doctor-secret-id");
    const output: string[] = [];

    writeSafeFailure(databaseError, ["--mode=precheck", "--customer-label=sekmon"], (value: string) => output.push(value));
    writeSafeFailure(unknownError, ["--mode=precheck", "--doctor-label=websthai"], (value: string) => output.push(value));

    expect(output).toEqual([
      JSON.stringify({ code: RUNNER_FAILURE_CODES.DATABASE_UNAVAILABLE, mode: "precheck", stage: "database" }),
      JSON.stringify({ code: RUNNER_FAILURE_CODES.UNKNOWN_SAFE_FAILURE, mode: "precheck", stage: "unknown" })
    ]);
    expect(output.join(" ")).not.toContain("never-print");
    expect(output.join(" ")).not.toContain("secret-id");
    expect(getSafeFailure(Object.assign(new Error("serialization conflict"), { code: "P2034" }))).toEqual({
      code: RUNNER_FAILURE_CODES.TRANSACTION_CONFLICT,
      stage: "transaction"
    });
  });
});
