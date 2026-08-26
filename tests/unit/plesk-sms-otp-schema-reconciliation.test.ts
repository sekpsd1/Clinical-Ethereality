/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
import { describe, expect, it, vi } from "vitest";
const { MIGRATION_APPROVAL_ENV } = require("../../scripts/plesk-runtime-migration-runner.cjs");
const {
  RECONCILIATION_APPROVAL_ENV,
  SMS_OTP_SCHEMA_MIGRATION,
  SMS_OTP_SCHEMA_RECONCILIATION_TARGET,
  classifySmsOtpSchema,
  createPhoneVerificationChallengeSchema,
  createPleskSmsOtpSchemaReconciliationRunner,
  inspectSmsOtpSchema
} = require("../../scripts/plesk-sms-otp-schema-reconciliation.cjs");

type SchemaState = {
  migration: "applied" | "not_applied" | "unexpected";
  user: "ready" | "not_ready";
  challenge: "absent" | "ready" | "partial_or_unexpected";
};

const exactPartialState: SchemaState = {
  migration: "not_applied",
  user: "ready",
  challenge: "absent"
};
const parityBeforeResolve: SchemaState = {
  migration: "not_applied",
  user: "ready",
  challenge: "ready"
};
const fullyReadyState: SchemaState = {
  migration: "applied",
  user: "ready",
  challenge: "ready"
};

function approvedEnv(extra: Record<string, string> = {}) {
  return {
    [RECONCILIATION_APPROVAL_ENV]: SMS_OTP_SCHEMA_RECONCILIATION_TARGET,
    DATABASE_URL: "mysql://private-user:private-password@private-host/private-db",
    JWT_SECRET: "private-jwt-secret",
    ...extra
  };
}

function createLoggers() {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    log: (message: string) => logs.push(message),
    error: (message: string) => errors.push(message),
    logs,
    errors
  };
}

function createClient() {
  return {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $disconnect: vi.fn().mockResolvedValue(undefined)
  };
}

function createInspector(states: Array<SchemaState | Error>) {
  return vi.fn(async () => {
    const state = states.shift();
    if (state instanceof Error) throw state;
    if (!state) throw new Error("unexpected inspector call");
    return state;
  });
}

function createOptions(states: Array<SchemaState | Error>) {
  const client = createClient();
  const spawnSync = vi.fn().mockReturnValue({ status: 0 });
  const createSchema = vi.fn(async (receivedClient) => receivedClient.$executeRaw("allowlisted-static-ddl"));
  const loggers = createLoggers();
  return {
    client,
    createSchema,
    inspectSchema: createInspector(states),
    loggers,
    options: {
      rootDir: "C:/approved-runtime",
      env: approvedEnv(),
      createClient: vi.fn(() => client),
      inspectSchema: undefined as unknown,
      createSchema,
      validateSource: vi.fn(() => true),
      spawnSync,
      ...loggers
    },
    spawnSync
  };
}

function withInspector(bundle: ReturnType<typeof createOptions>) {
  return { ...bundle.options, inspectSchema: bundle.inspectSchema };
}

function serializedLogs(loggers: ReturnType<typeof createLoggers>) {
  return [...loggers.logs, ...loggers.errors].join("\n");
}

function userColumns() {
  return [
    {
      name: "id",
      dataType: "varchar",
      isNullable: "NO",
      characterLength: 191,
      datetimePrecision: null,
      defaultValue: null
    },
    {
      name: "fullName",
      dataType: "varchar",
      isNullable: "YES",
      characterLength: 191,
      datetimePrecision: null,
      defaultValue: null
    },
    {
      name: "dateOfBirth",
      dataType: "date",
      isNullable: "YES",
      characterLength: null,
      datetimePrecision: null,
      defaultValue: null
    },
    {
      name: "normalizedPhone",
      dataType: "varchar",
      isNullable: "YES",
      characterLength: 20,
      datetimePrecision: null,
      defaultValue: null
    },
    {
      name: "phoneVerifiedAt",
      dataType: "datetime",
      isNullable: "YES",
      characterLength: null,
      datetimePrecision: 3,
      defaultValue: null
    }
  ];
}

function userIndexes() {
  return [
    {
      indexName: "User_normalizedPhone_key",
      nonUnique: 0,
      sequence: 1,
      columnName: "normalizedPhone",
      indexType: "BTREE"
    },
    {
      indexName: "User_phoneVerifiedAt_idx",
      nonUnique: 1,
      sequence: 1,
      columnName: "phoneVerifiedAt",
      indexType: "BTREE"
    }
  ];
}

function challengeColumns() {
  const column = (
    name: string,
    dataType: string,
    isNullable: "YES" | "NO",
    options: { characterLength?: number; datetimePrecision?: number; defaultValue?: string | null } = {}
  ) => ({
    name,
    dataType,
    isNullable,
    characterLength: options.characterLength ?? null,
    datetimePrecision: options.datetimePrecision ?? null,
    defaultValue: Object.prototype.hasOwnProperty.call(options, "defaultValue") ? options.defaultValue : null
  });

  return [
    column("id", "varchar", "NO", { characterLength: 191 }),
    column("userId", "varchar", "NO", { characterLength: 191 }),
    column("normalizedPhone", "varchar", "NO", { characterLength: 20 }),
    column("providerChallengeCiphertext", "text", "NO"),
    column("expiresAt", "datetime", "NO", { datetimePrecision: 3 }),
    column("attemptCount", "int", "NO", { defaultValue: "0" }),
    column("requestedAt", "datetime", "NO", { datetimePrecision: 3, defaultValue: "current_timestamp(3)" }),
    column("verifiedAt", "datetime", "YES", { datetimePrecision: 3 }),
    column("createdAt", "datetime", "NO", { datetimePrecision: 3, defaultValue: "current_timestamp(3)" }),
    column("updatedAt", "datetime", "NO", { datetimePrecision: 3 })
  ];
}

function challengeIndexes() {
  return [
    { indexName: "PRIMARY", nonUnique: 0, sequence: 1, columnName: "id", indexType: "BTREE" },
    {
      indexName: "PhoneVerificationChallenge_userId_expiresAt_idx",
      nonUnique: 1,
      sequence: 1,
      columnName: "userId",
      indexType: "BTREE"
    },
    {
      indexName: "PhoneVerificationChallenge_userId_expiresAt_idx",
      nonUnique: 1,
      sequence: 2,
      columnName: "expiresAt",
      indexType: "BTREE"
    },
    {
      indexName: "PhoneVerificationChallenge_userId_requestedAt_idx",
      nonUnique: 1,
      sequence: 1,
      columnName: "userId",
      indexType: "BTREE"
    },
    {
      indexName: "PhoneVerificationChallenge_userId_requestedAt_idx",
      nonUnique: 1,
      sequence: 2,
      columnName: "requestedAt",
      indexType: "BTREE"
    }
  ];
}

function rawSnapshot({ applied = false, challenge = false } = {}) {
  return {
    migrations: applied ? [{ name: SMS_OTP_SCHEMA_MIGRATION, finished: 1, rolledBack: 0 }] : [],
    userTables: [
      {
        name: "User",
        tableType: "BASE TABLE",
        tableCollation: "utf8mb4_unicode_ci",
        databaseCollation: "utf8mb4_unicode_ci"
      }
    ],
    userColumns: userColumns(),
    userIndexes: userIndexes(),
    challengeTables: challenge
      ? [
          {
            name: "PhoneVerificationChallenge",
            tableType: "BASE TABLE",
            tableCollation: "utf8mb4_unicode_ci"
          }
        ]
      : [],
    challengeColumns: challenge ? challengeColumns() : [],
    challengeIndexes: challenge ? challengeIndexes() : [],
    challengeForeignKeys: challenge
      ? [
          {
            constraintName: "PhoneVerificationChallenge_userId_fkey",
            tableName: "PhoneVerificationChallenge",
            columnName: "userId",
            referencedTableName: "User",
            referencedColumnName: "id",
            updateRule: "CASCADE",
            deleteRule: "CASCADE"
          }
        ]
      : []
  };
}

describe("Plesk SMS OTP partial-schema reconciliation", () => {
  it("leaves normal startup untouched when the reconciliation target is absent", async () => {
    const createClientMock = vi.fn();
    const runner = createPleskSmsOtpSchemaReconciliationRunner();

    await expect(
      runner({
        rootDir: "C:/approved-runtime",
        env: {},
        createClient: createClientMock
      })
    ).resolves.toEqual({ outcome: "not_requested", shouldStart: true, reconciliationRun: false });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it.each(["", SMS_OTP_SCHEMA_MIGRATION, `${SMS_OTP_SCHEMA_MIGRATION}:partial-schema-v0`, "arbitrary-target"])(
    "rejects empty, arbitrary, or stale target %s without logging its value",
    async (target) => {
      const runner = createPleskSmsOtpSchemaReconciliationRunner();
      const loggers = createLoggers();
      const createClientMock = vi.fn();

      const result = await runner({
        rootDir: "C:/approved-runtime",
        env: { [RECONCILIATION_APPROVAL_ENV]: target },
        createClient: createClientMock,
        ...loggers
      });

      expect(result).toEqual({ outcome: "target_rejected", shouldStart: false, reconciliationRun: false });
      expect(createClientMock).not.toHaveBeenCalled();
      if (target) expect(serializedLogs(loggers)).not.toContain(target);
    }
  );

  it("rejects simultaneous normal migration and reconciliation targets before database access", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const createClientMock = vi.fn();

    const result = await runner({
      rootDir: "C:/approved-runtime",
      env: approvedEnv({ [MIGRATION_APPROVAL_ENV]: SMS_OTP_SCHEMA_MIGRATION }),
      createClient: createClientMock,
      validateSource: vi.fn(() => true)
    });

    expect(result.outcome).toBe("target_conflict");
    expect(result.shouldStart).toBe(false);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects a changed or unavailable reviewed source before database access", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const createClientMock = vi.fn();

    const result = await runner({
      rootDir: "C:/approved-runtime",
      env: approvedEnv(),
      createClient: createClientMock,
      validateSource: vi.fn(() => false)
    });

    expect(result.outcome).toBe("source_rejected");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("creates only the absent challenge schema, verifies parity, resolves through Prisma, and still does not start", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState, parityBeforeResolve, fullyReadyState]);

    const result = await runner(withInspector(bundle));

    expect(result).toEqual({ outcome: "completed", shouldStart: false, reconciliationRun: true });
    expect(bundle.createSchema).toHaveBeenCalledTimes(1);
    expect(bundle.createSchema).toHaveBeenCalledWith(bundle.client);
    expect(bundle.spawnSync).toHaveBeenCalledTimes(1);
    expect(bundle.spawnSync).toHaveBeenCalledWith(
      process.execPath,
      [
        path.join("C:/approved-runtime", "node_modules", "prisma", "build", "index.js"),
        "migrate",
        "resolve",
        "--applied",
        SMS_OTP_SCHEMA_MIGRATION
      ],
      expect.objectContaining({ shell: false, stdio: "ignore", env: bundle.options.env })
    );
    expect(bundle.client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["already ready", fullyReadyState],
    ["migration applied but challenge table missing", { ...exactPartialState, migration: "applied" }],
    ["partial challenge table state", { ...exactPartialState, challenge: "partial_or_unexpected" }],
    ["required User component missing", { ...exactPartialState, user: "not_ready" }]
  ] as const)("fails closed for %s", async (_label, precondition) => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([precondition as SchemaState]);

    const result = await runner(withInspector(bundle));

    expect(result.outcome).toBe("precondition_rejected");
    expect(result.shouldStart).toBe(false);
    expect(bundle.createSchema).not.toHaveBeenCalled();
    expect(bundle.spawnSync).not.toHaveBeenCalled();
  });

  it("does not resolve migration history after DDL failure and redacts raw errors and secrets", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState]);
    bundle.options.createSchema = vi
      .fn()
      .mockRejectedValue(new Error("mysql://private-user:private-password@private-host/private-db"));

    const result = await runner(withInspector(bundle));
    const logs = serializedLogs(bundle.loggers);

    expect(result.outcome).toBe("schema_creation_failed");
    expect(bundle.spawnSync).not.toHaveBeenCalled();
    expect(logs).not.toContain("private-user");
    expect(logs).not.toContain("private-password");
    expect(logs).not.toContain("private-host");
    expect(logs).not.toContain("private-db");
    expect(logs).not.toContain("private-jwt-secret");
  });

  it("does not resolve migration history when post-create parity fails", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState, { ...parityBeforeResolve, challenge: "partial_or_unexpected" }]);

    const result = await runner(withInspector(bundle));

    expect(result.outcome).toBe("parity_failed");
    expect(bundle.createSchema).toHaveBeenCalledTimes(1);
    expect(bundle.spawnSync).not.toHaveBeenCalled();
  });

  it("fails closed and does not expose child errors when Prisma migrate resolve fails", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState, parityBeforeResolve]);
    bundle.spawnSync.mockReturnValue({ status: 1, error: new Error("private-password") });

    const result = await runner(withInspector(bundle));

    expect(result.outcome).toBe("migration_resolve_failed");
    expect(result.shouldStart).toBe(false);
    expect(serializedLogs(bundle.loggers)).not.toContain("private-password");
  });

  it("fails closed when final parity after migrate resolve is not ready", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState, parityBeforeResolve, parityBeforeResolve]);

    const result = await runner(withInspector(bundle));

    expect(result.outcome).toBe("final_parity_failed");
    expect(result.shouldStart).toBe(false);
  });

  it("returns a redacted unavailable result when read-only inspection fails", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([new Error("private-jwt-secret private-host")]);

    const result = await runner(withInspector(bundle));

    expect(result.outcome).toBe("inspection_unavailable");
    expect(result.shouldStart).toBe(false);
    expect(serializedLogs(bundle.loggers)).not.toContain("private-jwt-secret");
    expect(serializedLogs(bundle.loggers)).not.toContain("private-host");
  });

  it("rejects a duplicate invocation in the same process without executing DDL twice", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState, parityBeforeResolve, fullyReadyState]);
    const options = withInspector(bundle);

    const first = await runner(options);
    const second = await runner(options);

    expect(first.outcome).toBe("completed");
    expect(second.outcome).toBe("duplicate_rejected");
    expect(bundle.createSchema).toHaveBeenCalledTimes(1);
    expect(bundle.spawnSync).toHaveBeenCalledTimes(1);
  });

  it("classifies the exact Production partial shape and the fully ready shape", () => {
    expect(classifySmsOtpSchema(rawSnapshot())).toEqual(exactPartialState);
    expect(classifySmsOtpSchema(rawSnapshot({ applied: true, challenge: true }))).toEqual(fullyReadyState);
  });

  it("maps the static metadata-query results into the exact partial classification", async () => {
    const snapshot = rawSnapshot();
    const queryResults = [
      snapshot.userTables,
      snapshot.migrations,
      snapshot.userColumns,
      snapshot.userIndexes,
      snapshot.challengeTables,
      snapshot.challengeColumns,
      snapshot.challengeIndexes,
      snapshot.challengeForeignKeys
    ];
    const client = {
      $queryRaw: vi.fn(async () => queryResults.shift())
    };

    await expect(inspectSmsOtpSchema(client)).resolves.toEqual(exactPartialState);
    expect(client.$queryRaw).toHaveBeenCalledTimes(8);
  });

  it("uses one static DDL statement for only the empty challenge table dependency stack", async () => {
    const client = { $executeRaw: vi.fn().mockResolvedValue(0) };

    await createPhoneVerificationChallengeSchema(client);

    expect(client.$executeRaw).toHaveBeenCalledTimes(1);
    const query = client.$executeRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
    expect(query.values).toEqual([]);
    expect(query.sql).toContain("CREATE TABLE `PhoneVerificationChallenge`");
    expect(query.sql).toContain("PhoneVerificationChallenge_userId_expiresAt_idx");
    expect(query.sql).toContain("PhoneVerificationChallenge_userId_requestedAt_idx");
    expect(query.sql).toContain("PhoneVerificationChallenge_userId_fkey");
    expect(query.sql).not.toContain("ALTER TABLE `User`");
    expect(query.sql).not.toContain("INSERT INTO");
    expect(query.sql).not.toContain("UPDATE `User`");
  });

  it("accepts Prisma failed history when a later supported resolve row is successfully applied", () => {
    const snapshot = rawSnapshot({ applied: true, challenge: true });
    snapshot.migrations.unshift({ name: SMS_OTP_SCHEMA_MIGRATION, finished: 0, rolledBack: 0 });

    expect(classifySmsOtpSchema(snapshot).migration).toBe("applied");
  });

  it("classifies any partially present challenge dependency as unexpected", () => {
    const snapshot = rawSnapshot({ challenge: true });
    snapshot.challengeIndexes.pop();

    expect(classifySmsOtpSchema(snapshot).challenge).toBe("partial_or_unexpected");
  });
});
