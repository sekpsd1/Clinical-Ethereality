/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";
const {
  ACTION,
  ACTION_ENV,
  runPleskAccountBootstrap
} = require("../../scripts/zoom-test-plesk-account-bootstrap.cjs");

function dependencies() {
  const disconnect = vi.fn(async () => undefined);
  const fingerprint = "f".repeat(64);
  return {
    rootDir: "C:/test-app",
    env: { [ACTION_ENV]: ACTION },
    createPrisma: vi.fn(() => ({ $disconnect: disconnect })),
    parseOptions: vi.fn((args: string[]) => ({
      mode: args.find((value) => value.startsWith("--mode="))?.slice(7),
      databaseIdentityHash: "d".repeat(64),
      targetFingerprint: args.find((value) => value.startsWith("--target-fingerprint="))?.slice(21)
    })),
    assertIdentity: vi.fn(async () => "d".repeat(64)),
    assertSchema: vi.fn(async () => undefined),
    bootstrap: vi.fn(async (_prisma: unknown, options: { mode: string }) => ({
      status: "ok",
      mode: options.mode,
      fingerprint,
      replayed: options.mode === "verify"
    })),
    write: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    disconnect,
    fingerprint
  };
}

describe("Zoom Test Plesk account bootstrap action", () => {
  it("does nothing when the one-time action is absent", async () => {
    const deps = dependencies();
    delete deps.env[ACTION_ENV];

    await expect(runPleskAccountBootstrap(deps)).resolves.toEqual({
      requested: false,
      shouldStart: true,
      outcome: "not_requested"
    });
    expect(deps.bootstrap).not.toHaveBeenCalled();
  });

  it("runs precheck, apply, and verify without writing the fingerprint to status", async () => {
    const deps = dependencies();

    const result = await runPleskAccountBootstrap(deps);

    expect(result).toMatchObject({ requested: true, shouldStart: false, outcome: "complete" });
    expect(deps.bootstrap).toHaveBeenCalledTimes(3);
    expect(deps.parseOptions).toHaveBeenCalledWith(
      ["--mode=apply", "--confirm-test", `--target-fingerprint=${deps.fingerprint}`],
      deps.env
    );
    expect(deps.write).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "complete",
      stage: "complete",
      code: "READY"
    }));
    expect(JSON.stringify(deps.write.mock.calls)).not.toContain(deps.fingerprint);
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails closed before Prisma when the action value is invalid", async () => {
    const deps = dependencies();
    deps.env[ACTION_ENV] = "yes";

    const result = await runPleskAccountBootstrap(deps);

    expect(result).toMatchObject({ requested: true, shouldStart: false, outcome: "failed" });
    expect(deps.createPrisma).not.toHaveBeenCalled();
    expect(deps.bootstrap).not.toHaveBeenCalled();
  });
});
