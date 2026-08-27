import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  getCommittedMigrationNames,
  runApplicationMigrationStatusProbe
} from "@/features/admin/integrations/migration-status-probe";

const expectedMigration = "20260827113000_add_phone_otp_dispatch_claim";
const earlierMigration = "20260814090000_add_patient_phone_verification";
const otherMigration = "20260826090000_other_pending_migration";

function withMigrationRoot(names: readonly string[], run: (rootDir: string) => Promise<void>) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "migration-status-probe-"));
  const migrationsDir = path.join(rootDir, "prisma", "migrations");
  fs.mkdirSync(migrationsDir, { recursive: true });
  for (const name of names) fs.mkdirSync(path.join(migrationsDir, name));

  return run(rootDir).finally(() => fs.rmSync(rootDir, { force: true, recursive: true }));
}

function createClient(result: ReadonlyArray<Record<string, unknown>> | Error) {
  return {
    $queryRaw: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    })
  };
}

function applied(name: string) {
  return { name, finished: 1, rolledBack: 0 };
}

describe("application-runtime migration status probe", () => {
  it("writes ready when every committed migration is successfully applied", async () => {
    await withMigrationRoot([earlierMigration, expectedMigration], async (rootDir) => {
      const writeStatus = vi.fn();
      const result = await runApplicationMigrationStatusProbe({
        rootDir,
        client: createClient([applied(earlierMigration), applied(expectedMigration)]) as never,
        writeStatus
      });

      expect(result).toEqual({ status: "ready", migrationNames: [] });
      expect(writeStatus).toHaveBeenCalledWith({ rootDir, ...result });
    });
  });

  it("reports the sole expected pending migration", async () => {
    await withMigrationRoot([earlierMigration, expectedMigration], async (rootDir) => {
      const result = await runApplicationMigrationStatusProbe({
        rootDir,
        client: createClient([applied(earlierMigration)]) as never,
        writeStatus: vi.fn()
      });

      expect(result).toEqual({ status: "pending", migrationNames: [expectedMigration] });
    });
  });

  it("reports every other committed pending migration in fixed source order", async () => {
    await withMigrationRoot([expectedMigration, earlierMigration, otherMigration], async (rootDir) => {
      const result = await runApplicationMigrationStatusProbe({
        rootDir,
        client: createClient([applied(earlierMigration)]) as never,
        writeStatus: vi.fn()
      });

      expect(result).toEqual({
        status: "pending",
        migrationNames: [otherMigration, expectedMigration]
      });
    });
  });

  it("reports unresolved failed migration history instead of pending", async () => {
    await withMigrationRoot([earlierMigration, expectedMigration], async (rootDir) => {
      const result = await runApplicationMigrationStatusProbe({
        rootDir,
        client: createClient([
          applied(earlierMigration),
          { name: expectedMigration, finished: 0, rolledBack: 0 }
        ]) as never,
        writeStatus: vi.fn()
      });

      expect(result).toEqual({ status: "failed", migrationNames: [expectedMigration] });
    });
  });

  it("treats a later successful migration row as authoritative over failed history", async () => {
    await withMigrationRoot([earlierMigration, expectedMigration], async (rootDir) => {
      const result = await runApplicationMigrationStatusProbe({
        rootDir,
        client: createClient([
          applied(earlierMigration),
          { name: expectedMigration, finished: 0, rolledBack: 0 },
          applied(expectedMigration)
        ]) as never,
        writeStatus: vi.fn()
      });

      expect(result).toEqual({ status: "ready", migrationNames: [] });
    });
  });

  it("fails closed and redacts database-unavailable details", async () => {
    await withMigrationRoot([earlierMigration, expectedMigration], async (rootDir) => {
      const writeStatus = vi.fn();
      const rawError = "mysql://private-user:private-password@private-host/private-records";
      const result = await runApplicationMigrationStatusProbe({
        rootDir,
        client: createClient(new Error(rawError)) as never,
        writeStatus
      });

      expect(result).toEqual({ status: "failed", migrationNames: [] });
      expect(writeStatus).toHaveBeenCalledWith({ rootDir, ...result });
      expect(JSON.stringify({ result, calls: writeStatus.mock.calls })).not.toMatch(
        /private-user|private-password|private-host|private-records/
      );
    });
  });

  it("fails closed when a committed migration directory name is not allowlisted", async () => {
    await withMigrationRoot([earlierMigration, "unexpected-private-name"], async (rootDir) => {
      expect(() => getCommittedMigrationNames(rootDir)).toThrow("name is invalid");

      const writeStatus = vi.fn();
      const result = await runApplicationMigrationStatusProbe({
        rootDir,
        client: createClient([]) as never,
        writeStatus
      });

      expect(result).toEqual({ status: "failed", migrationNames: [] });
      expect(writeStatus).toHaveBeenCalledWith({ rootDir, ...result });
    });
  });
});
