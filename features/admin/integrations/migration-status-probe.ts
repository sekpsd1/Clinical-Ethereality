import { readdirSync } from "node:fs";
import path from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  writePleskMigrationStatus,
  type SafeMigrationStatus,
  type SafeMigrationStatusArtifact
} from "../../../scripts/plesk-migration-status.cjs";

const SAFE_MIGRATION_NAME = /^\d{14}_[a-z0-9_]+$/;

type MigrationRow = {
  name: string | null;
  finished: boolean | bigint | number | string | null;
  rolledBack: boolean | bigint | number | string | null;
};

type MigrationStatusClient = Pick<PrismaClient, "$queryRaw">;

type MigrationStatusWriter = (input: {
  rootDir?: string;
  status: SafeMigrationStatus;
  migrationNames: string[];
}) => string;

export type ApplicationMigrationStatus = Pick<
  SafeMigrationStatusArtifact,
  "status" | "migrationNames"
>;

function asBoolean(value: MigrationRow["finished"]): boolean {
  return value === true || value === 1 || value === BigInt(1) || value === "1";
}

export function getCommittedMigrationNames(rootDir: string): string[] {
  if (!path.isAbsolute(rootDir)) {
    throw new Error("Migration source root must be absolute.");
  }

  const migrationsDirectory = path.join(rootDir, "prisma", "migrations");
  const directories = readdirSync(migrationsDirectory, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory()
  );
  if (directories.some((entry) => !SAFE_MIGRATION_NAME.test(entry.name))) {
    throw new Error("Committed migration name is invalid.");
  }
  const names = directories.map((entry) => entry.name).sort();

  if (names.length === 0) {
    throw new Error("Committed migration source is unavailable.");
  }

  return names;
}

function classifyMigrationStatus(
  committedMigrations: readonly string[],
  rows: readonly MigrationRow[]
): ApplicationMigrationStatus {
  const applied = new Set<string>();
  const unresolvedFailures = new Set<string>();

  for (const migration of committedMigrations) {
    const migrationRows = rows.filter((row) => row.name === migration);
    if (migrationRows.some((row) => asBoolean(row.finished) && !asBoolean(row.rolledBack))) {
      applied.add(migration);
      continue;
    }
    if (migrationRows.some((row) => !asBoolean(row.finished) && !asBoolean(row.rolledBack))) {
      unresolvedFailures.add(migration);
    }
  }

  if (unresolvedFailures.size > 0) {
    return { status: "failed", migrationNames: [...unresolvedFailures].sort() };
  }

  const pending = committedMigrations.filter((migration) => !applied.has(migration));
  return pending.length > 0
    ? { status: "pending", migrationNames: pending }
    : { status: "ready", migrationNames: [] };
}

export async function runApplicationMigrationStatusProbe({
  client = prisma,
  rootDir,
  writeStatus = writePleskMigrationStatus
}: {
  client?: MigrationStatusClient;
  rootDir?: string;
  writeStatus?: MigrationStatusWriter;
} = {}): Promise<ApplicationMigrationStatus> {
  const applicationRoot = rootDir ?? process.env.__CE_PLESK_APPLICATION_ROOT;

  try {
    if (!applicationRoot || !path.isAbsolute(applicationRoot)) {
      throw new Error("Application migration source root is unavailable.");
    }
    const committedMigrations = getCommittedMigrationNames(applicationRoot);
    const rows = await client.$queryRaw<MigrationRow[]>(Prisma.sql`
      SELECT
        migration_name AS name,
        finished_at IS NOT NULL AS finished,
        rolled_back_at IS NOT NULL AS rolledBack
      FROM _prisma_migrations
      WHERE migration_name IN (${Prisma.join(committedMigrations)})
    `);
    const result = classifyMigrationStatus(committedMigrations, rows);
    writeStatus({ rootDir: applicationRoot, ...result });
    return result;
  } catch {
    const result: ApplicationMigrationStatus = { status: "failed", migrationNames: [] };
    try {
      if (applicationRoot && path.isAbsolute(applicationRoot)) {
        writeStatus({ rootDir: applicationRoot, ...result });
      }
    } catch {
      // The Admin page remains available; operators treat a missing artifact as unavailable.
    }
    return result;
  }
}
