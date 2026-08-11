/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";

const {
  FIXTURE_DURATION_MINUTES,
  getFixtureSummary,
  getOverlap,
  getTargetFingerprint,
  maskIdentifier,
  parseRunnerOptions,
  resolveTarget
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

describe("Zoom UAT fixture runner", () => {
  it("requires production confirmation, exact accounts, and a future ISO slot", () => {
    expect(() => parseRunnerOptions(productionArgs(), { NODE_ENV: "test" })).toThrow("Production confirmation");
    expect(() => parseRunnerOptions(productionArgs(["--customer-label=other"]), { NODE_ENV: "production" })).toThrow(
      "Duplicate argument"
    );
    expect(() =>
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
    ).toThrow("fixture-key");
  });

  it("requires a fingerprint for every mutating or verification mode", () => {
    expect(() =>
      parseRunnerOptions(
        productionArgs().map((argument) => (argument === "--mode=precheck" ? "--mode=create" : argument)),
        { NODE_ENV: "production" }
      )
    ).toThrow("target-fingerprint");
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
    expect(() => getOverlap([{ bookedDurationMinutes: 1000, scheduledAt }], scheduledAt)).toThrow("safe range");
  });

  it("fails closed when target resolution is not uniquely eligible", async () => {
    const options = parseRunnerOptions(productionArgs(), { NODE_ENV: "production" });
    const prisma = {
      doctor: { findMany: async () => [{ id: "doctor-1", userId: "doctor-user-1" }, { id: "doctor-2", userId: "doctor-user-2" }] },
      user: { findMany: async () => [{ id: "customer-1" }] }
    };

    await expect(resolveTarget(prisma, options)).rejects.toThrow("not uniquely eligible");
  });
});
