/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it, vi } from "vitest";
const {
  ZOOM_TEST_MIGRATION_ACTION,
  ZOOM_TEST_MIGRATION_ACTION_ENV,
  runZoomTestPleskMigration
} = require("../../scripts/zoom-test-plesk-migration.cjs");

function dependencies() {
  const disconnect = vi.fn(async () => undefined);
  return {
    rootDir: "C:/test-app",
    env: { [ZOOM_TEST_MIGRATION_ACTION_ENV]: ZOOM_TEST_MIGRATION_ACTION },
    createPrisma: vi.fn(() => ({ $disconnect: disconnect })),
    parseOptions: vi.fn(() => ({ databaseIdentityHash: "a".repeat(64) })),
    precheck: vi.fn(async () => ({ databaseIdentity: "matched" })),
    spawnSync: vi.fn((_command: string, _args: string[]) => ({ status: 0 })),
    existsSync: vi.fn(() => true),
    writeStatus: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    disconnect
  };
}

describe("Zoom Test Plesk migration action", () => {
  it("does nothing when the one-time action is absent", async () => {
    const deps = dependencies();
    delete deps.env[ZOOM_TEST_MIGRATION_ACTION_ENV];

    const result = await runZoomTestPleskMigration(deps);

    expect(result).toEqual({ requested: false, shouldStart: true, outcome: "not_requested" });
    expect(deps.precheck).not.toHaveBeenCalled();
    expect(deps.spawnSync).not.toHaveBeenCalled();
  });

  it("runs identity preflight before deploy and status, then stops startup", async () => {
    const deps = dependencies();

    const result = await runZoomTestPleskMigration(deps);

    expect(result).toMatchObject({ requested: true, shouldStart: false, outcome: "complete" });
    expect(deps.parseOptions).toHaveBeenCalledWith(["--confirm-test"], deps.env);
    expect(deps.precheck).toHaveBeenCalledTimes(1);
    expect(deps.disconnect).toHaveBeenCalledTimes(1);
    expect(deps.spawnSync).toHaveBeenCalledTimes(2);
    expect(deps.spawnSync.mock.calls[0][1]).toEqual(expect.arrayContaining(["migrate", "deploy"]));
    expect(deps.spawnSync.mock.calls[1][1]).toEqual(expect.arrayContaining(["migrate", "status"]));
    expect(deps.writeStatus).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "complete",
      stage: "complete",
      code: "READY"
    }));
  });

  it("fails closed before Prisma when the action value is not exact", async () => {
    const deps = dependencies();
    deps.env[ZOOM_TEST_MIGRATION_ACTION_ENV] = "yes";

    const result = await runZoomTestPleskMigration(deps);

    expect(result).toMatchObject({ requested: true, shouldStart: false, outcome: "failed" });
    expect(deps.precheck).not.toHaveBeenCalled();
    expect(deps.spawnSync).not.toHaveBeenCalled();
  });

  it("does not deploy when database preflight fails", async () => {
    const deps = dependencies();
    deps.precheck.mockRejectedValue(Object.assign(new Error("hidden"), {
      code: "DATABASE_IDENTITY_MISMATCH",
      stage: "database"
    }));

    const result = await runZoomTestPleskMigration(deps);

    expect(result).toMatchObject({
      requested: true,
      shouldStart: false,
      outcome: "failed",
      stage: "preflight"
    });
    expect(deps.spawnSync).not.toHaveBeenCalled();
  });

  it("fails closed when migration deploy fails", async () => {
    const deps = dependencies();
    deps.spawnSync.mockReturnValueOnce({ status: 1 });

    const result = await runZoomTestPleskMigration(deps);

    expect(result).toMatchObject({ code: "MIGRATION_FAILED", shouldStart: false });
    expect(deps.spawnSync).toHaveBeenCalledTimes(1);
  });
});
