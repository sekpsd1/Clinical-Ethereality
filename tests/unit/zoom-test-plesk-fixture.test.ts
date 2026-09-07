/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";
const { ACTION, ACTION_ENV, FIXTURE_KEY_ENV, SCHEDULED_AT_ENV, runPleskFixture } =
  require("../../scripts/zoom-test-plesk-fixture.cjs");

function dependencies() {
  const disconnect = vi.fn(async () => undefined);
  const fingerprint = "a".repeat(64);
  return {
    rootDir: "C:/test-app",
    env: {
      [ACTION_ENV]: ACTION,
      [FIXTURE_KEY_ENV]: "android-uat-20260907",
      [SCHEDULED_AT_ENV]: "2026-09-07T17:00:00.000Z"
    },
    createPrisma: vi.fn(() => ({ $disconnect: disconnect })),
    parseOptions: vi.fn((args: string[]) => ({
      mode: args.find((value) => value.startsWith("--mode="))?.slice(7),
      databaseIdentityHash: "d".repeat(64)
    })),
    assertIdentity: vi.fn(async () => "d".repeat(64)),
    assertSchema: vi.fn(async () => undefined),
    runFixture: vi.fn(async (_prisma: unknown, options: { mode: string }) => ({
      status: "ok",
      fingerprint,
      fixtureStatus: options.mode === "precheck" ? "absent" : "scheduled",
      zoom: "absent"
    })),
    write: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    disconnect,
    fingerprint
  };
}

describe("Zoom Test Plesk fixture action", () => {
  it("does nothing when the action is absent", async () => {
    const deps = dependencies();
    delete deps.env[ACTION_ENV];
    await expect(runPleskFixture(deps)).resolves.toEqual({
      requested: false, shouldStart: true, outcome: "not_requested"
    });
    expect(deps.runFixture).not.toHaveBeenCalled();
  });

  it("runs precheck, create, and verify without writing the fingerprint to status", async () => {
    const deps = dependencies();
    const result = await runPleskFixture(deps);
    expect(result).toMatchObject({ requested: true, shouldStart: false, outcome: "complete" });
    expect(deps.runFixture).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(deps.write.mock.calls)).not.toContain(deps.fingerprint);
    expect(deps.write).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "complete", stage: "complete", code: "READY"
    }));
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
  });
});
