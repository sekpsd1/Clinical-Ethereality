import { describe, expect, it, vi } from "vitest";
import {
  SMS_OTP_SCHEMA_COMPONENTS,
  SMS_OTP_SCHEMA_MIGRATION,
  getSmsOtpSchemaReadiness
} from "@/features/admin/integrations/sms-otp-schema-readiness";

type QueryResult = ReadonlyArray<Record<string, unknown>> | Error;

function createClient(results: readonly QueryResult[]) {
  let index = 0;
  return {
    $queryRaw: vi.fn(async () => {
      const result = results[index++];
      if (result instanceof Error) throw result;
      return result;
    })
  };
}

const appliedMigration = [{ name: SMS_OTP_SCHEMA_MIGRATION, finished: 1, rolledBack: 0 }];
const userColumns = ["fullName", "dateOfBirth", "normalizedPhone", "phoneVerifiedAt"].map((name) => ({ name }));
const challengeTables = [{ name: "PhoneVerificationChallenge" }];
const challengeColumns = [
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
].map((name) => ({ name }));
const indexes = [
  { tableName: "User", indexName: "User_normalizedPhone_key", nonUnique: 0, sequence: 1, columnName: "normalizedPhone" },
  { tableName: "User", indexName: "User_phoneVerifiedAt_idx", nonUnique: 1, sequence: 1, columnName: "phoneVerifiedAt" },
  { tableName: "PhoneVerificationChallenge", indexName: "PRIMARY", nonUnique: 0, sequence: 1, columnName: "id" },
  {
    tableName: "PhoneVerificationChallenge",
    indexName: "PhoneVerificationChallenge_userId_expiresAt_idx",
    nonUnique: 1,
    sequence: 1,
    columnName: "userId"
  },
  {
    tableName: "PhoneVerificationChallenge",
    indexName: "PhoneVerificationChallenge_userId_expiresAt_idx",
    nonUnique: 1,
    sequence: 2,
    columnName: "expiresAt"
  },
  {
    tableName: "PhoneVerificationChallenge",
    indexName: "PhoneVerificationChallenge_userId_requestedAt_idx",
    nonUnique: 1,
    sequence: 1,
    columnName: "userId"
  },
  {
    tableName: "PhoneVerificationChallenge",
    indexName: "PhoneVerificationChallenge_userId_requestedAt_idx",
    nonUnique: 1,
    sequence: 2,
    columnName: "requestedAt"
  }
];
const foreignKeys = [
  {
    constraintName: "PhoneVerificationChallenge_userId_fkey",
    tableName: "PhoneVerificationChallenge",
    columnName: "userId",
    referencedTableName: "User",
    referencedColumnName: "id",
    updateRule: "CASCADE",
    deleteRule: "CASCADE"
  }
];

function readyResults(): QueryResult[] {
  return [appliedMigration, userColumns, challengeTables, challengeColumns, indexes, foreignKeys];
}

function componentStatus(result: Awaited<ReturnType<typeof getSmsOtpSchemaReadiness>>, name: string) {
  return result.components.find((component) => component.name === name)?.status;
}

describe("Admin SMS OTP schema readiness", () => {
  it("is ready only when the migration, columns, table, indexes, and foreign key are ready", async () => {
    const result = await getSmsOtpSchemaReadiness(createClient(readyResults()) as never);

    expect(result.status).toBe("ready");
    expect(result.components).toHaveLength(SMS_OTP_SCHEMA_COMPONENTS.length);
    expect(result.components.every((component) => component.status === "ready")).toBe(true);
  });

  it("is not ready when the migration record is missing", async () => {
    const results = readyResults();
    results[0] = [];

    const result = await getSmsOtpSchemaReadiness(createClient(results) as never);

    expect(result.status).toBe("not_ready");
    expect(componentStatus(result, `migration:${SMS_OTP_SCHEMA_MIGRATION}`)).toBe("not_ready");
  });

  it("is not ready when the migration is unfinished or rolled back", async () => {
    for (const migration of [
      [{ name: SMS_OTP_SCHEMA_MIGRATION, finished: 0, rolledBack: 0 }],
      [{ name: SMS_OTP_SCHEMA_MIGRATION, finished: 1, rolledBack: 1 }]
    ]) {
      const results = readyResults();
      results[0] = migration;

      const result = await getSmsOtpSchemaReadiness(createClient(results) as never);
      expect(componentStatus(result, `migration:${SMS_OTP_SCHEMA_MIGRATION}`)).toBe("not_ready");
    }
  });

  it("is ready when Prisma keeps failed history alongside a successfully resolved row", async () => {
    const results = readyResults();
    results[0] = [
      { name: SMS_OTP_SCHEMA_MIGRATION, finished: 0, rolledBack: 0 },
      { name: SMS_OTP_SCHEMA_MIGRATION, finished: 1, rolledBack: 0 }
    ];

    const result = await getSmsOtpSchemaReadiness(createClient(results) as never);

    expect(result.status).toBe("ready");
    expect(componentStatus(result, `migration:${SMS_OTP_SCHEMA_MIGRATION}`)).toBe("ready");
  });

  it.each([
    ["table", 2, [], "PhoneVerificationChallenge.table"],
    ["User column", 1, userColumns.slice(0, -1), "User.columns"],
    ["challenge column", 3, challengeColumns.slice(0, -1), "PhoneVerificationChallenge.columns"],
    ["index", 4, indexes.slice(0, -1), "PhoneVerificationChallenge.userId_requestedAt.index"],
    ["foreign key", 5, [], "PhoneVerificationChallenge.userId.foreign_key"]
  ] as const)("is not ready when a required %s is missing", async (_kind, resultIndex, replacement, componentName) => {
    const results = readyResults();
    results[resultIndex] = replacement;

    const result = await getSmsOtpSchemaReadiness(createClient(results) as never);

    expect(result.status).toBe("not_ready");
    expect(componentStatus(result, componentName)).toBe("not_ready");
  });

  it("returns only unavailable statuses and safe component names when the database cannot be checked", async () => {
    const rawError = "mysql://private-user:private-password@private-host/patient-records";
    const result = await getSmsOtpSchemaReadiness(createClient([new Error(rawError)]) as never);
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("unavailable");
    expect(result.components.map((component) => component.name)).toEqual(SMS_OTP_SCHEMA_COMPONENTS);
    expect(result.components.every((component) => component.status === "unavailable")).toBe(true);
    expect(serialized).not.toContain("private-user");
    expect(serialized).not.toContain("private-password");
    expect(serialized).not.toContain("private-host");
    expect(serialized).not.toContain("patient-records");
  });
});
