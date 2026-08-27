import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export const SMS_OTP_SCHEMA_MIGRATIONS = [
  "20260814090000_add_patient_phone_verification",
  "20260827113000_add_phone_otp_dispatch_claim"
] as const;

const REQUIRED_USER_COLUMNS = [
  "fullName",
  "dateOfBirth",
  "normalizedPhone",
  "phoneVerifiedAt",
  "phoneOtpDispatchClaimedUntil"
] as const;
const REQUIRED_CHALLENGE_COLUMNS = [
  "id",
  "userId",
  "normalizedPhone",
  "providerChallengeCiphertext",
  "expiresAt",
  "attemptCount",
  "requestedAt",
  "verifiedAt",
  "createdAt",
  "updatedAt"
] as const;

export const SMS_OTP_SCHEMA_COMPONENTS = [
  ...SMS_OTP_SCHEMA_MIGRATIONS.map((migration) => `migration:${migration}` as const),
  "User.columns",
  "User.normalizedPhone.unique",
  "User.phoneVerifiedAt.index",
  "PhoneVerificationChallenge.table",
  "PhoneVerificationChallenge.columns",
  "PhoneVerificationChallenge.primary_key",
  "PhoneVerificationChallenge.userId_expiresAt.index",
  "PhoneVerificationChallenge.userId_requestedAt.index",
  "PhoneVerificationChallenge.userId.foreign_key"
] as const;

export type SmsOtpSchemaComponentName = (typeof SMS_OTP_SCHEMA_COMPONENTS)[number];
export type SmsOtpSchemaReadinessStatus = "ready" | "not_ready" | "unavailable";

export type SmsOtpSchemaReadinessComponent = {
  name: SmsOtpSchemaComponentName;
  status: SmsOtpSchemaReadinessStatus;
};

export type SmsOtpSchemaReadiness = {
  status: SmsOtpSchemaReadinessStatus;
  components: SmsOtpSchemaReadinessComponent[];
};

type MigrationRow = {
  name: string | null;
  finished: boolean | bigint | number | string | null;
  rolledBack: boolean | bigint | number | string | null;
};
type NameRow = { name: string | null };
type IndexRow = {
  tableName: string | null;
  indexName: string | null;
  nonUnique: bigint | number | string | null;
  sequence: bigint | number | string | null;
  columnName: string | null;
};
type ForeignKeyRow = {
  constraintName: string | null;
  tableName: string | null;
  columnName: string | null;
  referencedTableName: string | null;
  referencedColumnName: string | null;
  updateRule: string | null;
  deleteRule: string | null;
};

type SmsOtpSchemaReadinessClient = Pick<PrismaClient, "$queryRaw">;

function asBoolean(value: MigrationRow["finished"]): boolean {
  return value === true || value === 1 || value === BigInt(1) || value === "1";
}

function includesAll(rows: NameRow[], required: readonly string[]): boolean {
  const found = new Set(rows.map((row) => row.name).filter((name): name is string => Boolean(name)));
  return required.every((name) => found.has(name));
}

function hasIndex(
  rows: IndexRow[],
  tableName: string,
  indexName: string,
  columns: readonly string[],
  unique: boolean
): boolean {
  const matching = rows
    .filter((row) => row.tableName === tableName && row.indexName === indexName)
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));

  return (
    matching.length === columns.length &&
    matching.every(
      (row, index) =>
        row.columnName === columns[index] &&
        Number(row.sequence) === index + 1 &&
        Number(row.nonUnique) === (unique ? 0 : 1)
    )
  );
}

function component(name: SmsOtpSchemaComponentName, ready: boolean): SmsOtpSchemaReadinessComponent {
  return { name, status: ready ? "ready" : "not_ready" };
}

function unavailableReadiness(): SmsOtpSchemaReadiness {
  return {
    status: "unavailable",
    components: SMS_OTP_SCHEMA_COMPONENTS.map((name) => ({ name, status: "unavailable" }))
  };
}

/**
 * Admin-only callers receive allowlisted component names and coarse statuses.
 * Static metadata queries never return datasource details, record values, or raw errors.
 */
export async function getSmsOtpSchemaReadiness(
  client: SmsOtpSchemaReadinessClient = prisma
): Promise<SmsOtpSchemaReadiness> {
  try {
    const [migrations, userColumns, challengeTables, challengeColumns, indexes, foreignKeys] =
      await Promise.all([
        client.$queryRaw<MigrationRow[]>(Prisma.sql`
          SELECT
            migration_name AS name,
            finished_at IS NOT NULL AS finished,
            rolled_back_at IS NOT NULL AS rolledBack
          FROM _prisma_migrations
          WHERE migration_name IN (${Prisma.join(SMS_OTP_SCHEMA_MIGRATIONS)})
        `),
        client.$queryRaw<NameRow[]>(Prisma.sql`
          SELECT COLUMN_NAME AS name
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'User'
            AND COLUMN_NAME IN (${Prisma.join(REQUIRED_USER_COLUMNS)})
        `),
        client.$queryRaw<NameRow[]>(Prisma.sql`
          SELECT TABLE_NAME AS name
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'PhoneVerificationChallenge'
            AND TABLE_TYPE = 'BASE TABLE'
        `),
        client.$queryRaw<NameRow[]>(Prisma.sql`
          SELECT COLUMN_NAME AS name
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'PhoneVerificationChallenge'
            AND COLUMN_NAME IN (${Prisma.join(REQUIRED_CHALLENGE_COLUMNS)})
        `),
        client.$queryRaw<IndexRow[]>(Prisma.sql`
          SELECT
            TABLE_NAME AS tableName,
            INDEX_NAME AS indexName,
            NON_UNIQUE AS nonUnique,
            SEQ_IN_INDEX AS sequence,
            COLUMN_NAME AS columnName
          FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE()
            AND (
              (TABLE_NAME = 'User' AND INDEX_NAME IN ('User_normalizedPhone_key', 'User_phoneVerifiedAt_idx'))
              OR
              (TABLE_NAME = 'PhoneVerificationChallenge' AND INDEX_NAME IN (
                'PRIMARY',
                'PhoneVerificationChallenge_userId_expiresAt_idx',
                'PhoneVerificationChallenge_userId_requestedAt_idx'
              ))
            )
        `),
        client.$queryRaw<ForeignKeyRow[]>(Prisma.sql`
          SELECT
            keyUsage.CONSTRAINT_NAME AS constraintName,
            keyUsage.TABLE_NAME AS tableName,
            keyUsage.COLUMN_NAME AS columnName,
            keyUsage.REFERENCED_TABLE_NAME AS referencedTableName,
            keyUsage.REFERENCED_COLUMN_NAME AS referencedColumnName,
            referential.UPDATE_RULE AS updateRule,
            referential.DELETE_RULE AS deleteRule
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS keyUsage
          INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS referential
            ON referential.CONSTRAINT_SCHEMA = keyUsage.CONSTRAINT_SCHEMA
            AND referential.TABLE_NAME = keyUsage.TABLE_NAME
            AND referential.CONSTRAINT_NAME = keyUsage.CONSTRAINT_NAME
          WHERE keyUsage.CONSTRAINT_SCHEMA = DATABASE()
            AND keyUsage.TABLE_NAME = 'PhoneVerificationChallenge'
            AND keyUsage.CONSTRAINT_NAME = 'PhoneVerificationChallenge_userId_fkey'
        `)
      ]);

    const migrationReady = (migration: (typeof SMS_OTP_SCHEMA_MIGRATIONS)[number]) =>
      migrations.some(
        (row) => row.name === migration && asBoolean(row.finished) && !asBoolean(row.rolledBack)
      );
    const foreignKeyReady = foreignKeys.some(
      (row) =>
        row.constraintName === "PhoneVerificationChallenge_userId_fkey" &&
        row.tableName === "PhoneVerificationChallenge" &&
        row.columnName === "userId" &&
        row.referencedTableName === "User" &&
        row.referencedColumnName === "id" &&
        row.updateRule?.toUpperCase() === "CASCADE" &&
        row.deleteRule?.toUpperCase() === "CASCADE"
    );

    const components: SmsOtpSchemaReadinessComponent[] = [
      ...SMS_OTP_SCHEMA_MIGRATIONS.map((migration) =>
        component(`migration:${migration}`, migrationReady(migration))
      ),
      component("User.columns", includesAll(userColumns, REQUIRED_USER_COLUMNS)),
      component(
        "User.normalizedPhone.unique",
        hasIndex(indexes, "User", "User_normalizedPhone_key", ["normalizedPhone"], true)
      ),
      component(
        "User.phoneVerifiedAt.index",
        hasIndex(indexes, "User", "User_phoneVerifiedAt_idx", ["phoneVerifiedAt"], false)
      ),
      component(
        "PhoneVerificationChallenge.table",
        includesAll(challengeTables, ["PhoneVerificationChallenge"])
      ),
      component("PhoneVerificationChallenge.columns", includesAll(challengeColumns, REQUIRED_CHALLENGE_COLUMNS)),
      component(
        "PhoneVerificationChallenge.primary_key",
        hasIndex(indexes, "PhoneVerificationChallenge", "PRIMARY", ["id"], true)
      ),
      component(
        "PhoneVerificationChallenge.userId_expiresAt.index",
        hasIndex(indexes, "PhoneVerificationChallenge", "PhoneVerificationChallenge_userId_expiresAt_idx", [
          "userId",
          "expiresAt"
        ], false)
      ),
      component(
        "PhoneVerificationChallenge.userId_requestedAt.index",
        hasIndex(indexes, "PhoneVerificationChallenge", "PhoneVerificationChallenge_userId_requestedAt_idx", [
          "userId",
          "requestedAt"
        ], false)
      ),
      component("PhoneVerificationChallenge.userId.foreign_key", foreignKeyReady)
    ];

    return {
      status: components.every((item) => item.status === "ready") ? "ready" : "not_ready",
      components
    };
  } catch {
    return unavailableReadiness();
  }
}
