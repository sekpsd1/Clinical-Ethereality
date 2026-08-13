/* eslint-disable @typescript-eslint/no-require-imports */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  LOCK_STALE_AFTER_MS,
  checkReadiness,
  readStatus,
  runCleanupJob,
} = require("../../scripts/store-reservation-cleanup-runner.cjs");

const workspaces: string[] = [];

function createEnvironment() {
  const stateDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "store-reservation-cleanup-runner-"),
  );
  workspaces.push(stateDirectory);

  return {
    STORE_RESERVATION_CLEANUP_SECRET:
      "a-secure-test-secret-with-at-least-32-characters",
    STORE_RESERVATION_CLEANUP_URL:
      "https://app.example.test/api/jobs/store-reservation-cleanup",
    STORE_RESERVATION_CLEANUP_STATE_DIR: stateDirectory,
    STORE_RESERVATION_CLEANUP_ALERT_AFTER_MINUTES: "15",
  };
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});

describe("Store reservation cleanup runner", () => {
  it("calls the authenticated endpoint, records only safe status, and reports readiness", async () => {
    const env = createEnvironment();
    const secret = env.STORE_RESERVATION_CLEANUP_SECRET;
    const fetchImpl = vi.fn(async (_url: URL, init: RequestInit) => {
      expect(init.headers).toEqual({ "x-clinical-job-secret": secret });
      return new Response(
        JSON.stringify({
          ok: true,
          result: { candidates: 2, released: 1, skipped: 1 },
        }),
        { status: 200 },
      );
    });
    const log = vi.fn();
    const error = vi.fn();
    const times = [
      new Date("2026-08-13T15:00:00.000Z"),
      new Date("2026-08-13T15:00:01.000Z"),
    ];

    const result = await runCleanupJob({
      env,
      fetchImpl,
      now: () => times.shift() ?? times[0],
      log,
      error,
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
    expect(JSON.stringify(readStatus(env.STORE_RESERVATION_CLEANUP_STATE_DIR))).not.toContain(
      secret,
    );
    expect(
      checkReadiness({
        env,
        now: new Date("2026-08-13T15:10:00.000Z"),
        log,
        error,
      }).ready,
    ).toBe(true);
  });

  it("fails readiness after fifteen minutes without a successful run", async () => {
    const env = createEnvironment();
    const log = vi.fn();
    const error = vi.fn();
    const times = [
      new Date("2026-08-13T15:00:00.000Z"),
      new Date("2026-08-13T15:00:01.000Z"),
    ];

    await runCleanupJob({
      env,
      fetchImpl: vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            result: { candidates: 0, released: 0, skipped: 0 },
          }),
          { status: 200 },
        ),
      ),
      now: () => times.shift() ?? times[0],
      log,
      error,
    });

    const readiness = checkReadiness({
      env,
      now: new Date("2026-08-13T15:16:00.000Z"),
      log,
      error,
    });

    expect(readiness).toMatchObject({
      exitCode: 1,
      ready: false,
      reason: "last_success_stale",
      ageMinutes: 15,
    });
  });

  it("does not make a second request while another runner holds the lock", async () => {
    const env = createEnvironment();
    const lockPath = path.join(
      env.STORE_RESERVATION_CLEANUP_STATE_DIR,
      "runner.lock",
    );
    fs.writeFileSync(lockPath, "locked\n");
    const recent = new Date(Date.now() - LOCK_STALE_AFTER_MS / 2);
    fs.utimesSync(lockPath, recent, recent);
    const fetchImpl = vi.fn();

    const result = await runCleanupJob({ env, fetchImpl, log: vi.fn(), error: vi.fn() });

    expect(result).toEqual({ exitCode: 0, code: "runner_locked" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed without logging a missing secret value", async () => {
    const env = createEnvironment();
    delete (env as Partial<typeof env>).STORE_RESERVATION_CLEANUP_SECRET;
    const error = vi.fn();

    const result = await runCleanupJob({ env, log: vi.fn(), error });

    expect(result).toEqual({ exitCode: 1, code: "secret_missing" });
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("STORE_RESERVATION_CLEANUP_SECRET"),
    );
  });
});
