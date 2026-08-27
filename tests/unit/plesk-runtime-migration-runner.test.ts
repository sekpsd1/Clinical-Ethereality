/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
import { afterEach, describe, expect, it, vi } from "vitest";
const {
  MIGRATION_APPROVAL_ENV,
  SMS_OTP_MIGRATION_TARGET,
  getCurrentMigrationTarget,
  runPleskRuntimeMigration
} = require("../../scripts/plesk-runtime-migration-runner.cjs");

const workspaces: string[] = [];

function createRunnerWorkspace(migrations = [
  "20260809120000_add_payment_normalized_transaction_reference",
  SMS_OTP_MIGRATION_TARGET
]) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "plesk-runtime-migration-runner-"));
  workspaces.push(rootDir);

  for (const migration of migrations) {
    const migrationDir = path.join(rootDir, "prisma", "migrations", migration);
    fs.mkdirSync(migrationDir, { recursive: true });
    fs.writeFileSync(path.join(migrationDir, "migration.sql"), "SELECT 1;\n");
  }

  const prismaCli = path.join(rootDir, "node_modules", "prisma", "build");
  fs.mkdirSync(prismaCli, { recursive: true });
  fs.writeFileSync(path.join(prismaCli, "index.js"), "// test fixture\n");

  return rootDir;
}

function createLoggers() {
  const logs: string[] = [];
  const errors: string[] = [];

  return {
    error: (message: string) => errors.push(message),
    errors,
    log: (message: string) => logs.push(message),
    logs
  };
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});

describe("Plesk runtime migration runner", () => {
  it("derives the current target from the latest migration directory", () => {
    const rootDir = createRunnerWorkspace([
      "20260809140000_add_manual_store_refund_fields",
      "20260809120000_add_payment_normalized_transaction_reference"
    ]);

    expect(getCurrentMigrationTarget(rootDir)).toBe("20260809140000_add_manual_store_refund_fields");
  });

  it("starts without migrations when the approval flag is absent", () => {
    const spawnSync = vi.fn();
    const result = runPleskRuntimeMigration({
      rootDir: createRunnerWorkspace(),
      env: {},
      spawnSync
    });

    expect(result).toEqual({ shouldStart: true, migrationRun: false });
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("fails closed when the approval flag is not the fixed SMS OTP target", () => {
    const spawnSync = vi.fn();
    const loggers = createLoggers();
    const result = runPleskRuntimeMigration({
      rootDir: createRunnerWorkspace(),
      env: { [MIGRATION_APPROVAL_ENV]: "20260809120000_add_payment_normalized_transaction_reference" },
      spawnSync,
      ...loggers
    });

    expect(result).toEqual({ shouldStart: false, migrationRun: false });
    expect(spawnSync).not.toHaveBeenCalled();
    expect(loggers.errors).toEqual([
      "[plesk-migration] Migration target is not allowlisted; standalone server will not start."
    ]);
  });

  it("fails closed when the allowlisted target is not the latest source migration", () => {
    const spawnSync = vi.fn();
    const loggers = createLoggers();
    const result = runPleskRuntimeMigration({
      rootDir: createRunnerWorkspace([SMS_OTP_MIGRATION_TARGET, "20260828000000_future_migration"]),
      env: { [MIGRATION_APPROVAL_ENV]: SMS_OTP_MIGRATION_TARGET },
      spawnSync,
      ...loggers
    });

    expect(result).toEqual({ shouldStart: false, migrationRun: false });
    expect(spawnSync).not.toHaveBeenCalled();
    expect(loggers.errors).toEqual([
      "[plesk-migration] Allowlisted migration is not the current source migration; standalone server will not start."
    ]);
  });

  it("runs Prisma through the Node runtime only for an exact approval target", () => {
    const rootDir = createRunnerWorkspace();
    const env = {
      [MIGRATION_APPROVAL_ENV]: SMS_OTP_MIGRATION_TARGET,
      DATABASE_URL: "database-url-value"
    };
    const spawnSync = vi.fn().mockReturnValue({ status: 0 });
    const loggers = createLoggers();

    const result = runPleskRuntimeMigration({ rootDir, env, spawnSync, ...loggers });

    expect(result).toEqual({ shouldStart: true, migrationRun: true });
    expect(spawnSync).toHaveBeenCalledWith(
      process.execPath,
      [path.join(rootDir, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
      expect.objectContaining({
        cwd: rootDir,
        env,
        shell: false,
        stdio: "ignore"
      })
    );
    expect(loggers.logs.join("\n")).not.toContain(env.DATABASE_URL);
  });

  it("fails closed and never logs secrets when Prisma migration fails", () => {
    const rootDir = createRunnerWorkspace();
    const env = {
      [MIGRATION_APPROVAL_ENV]: SMS_OTP_MIGRATION_TARGET,
      DATABASE_URL: "database-url-value",
      JWT_SECRET: "jwt-value"
    };
    const spawnSync = vi.fn().mockReturnValue({
      error: new Error("database-url-value"),
      status: 1
    });
    const loggers = createLoggers();

    const result = runPleskRuntimeMigration({ rootDir, env, spawnSync, ...loggers });
    const emittedLogs = [...loggers.logs, ...loggers.errors].join("\n");

    expect(result).toEqual({ shouldStart: false, migrationRun: true });
    expect(emittedLogs).not.toContain(env.DATABASE_URL);
    expect(emittedLogs).not.toContain(env.JWT_SECRET);
  });
});
