/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
import { describe, expect, it, vi } from "vitest";
const { MIGRATION_APPROVAL_ENV } = require("../../scripts/plesk-runtime-migration-runner.cjs");
const {
  RECONCILIATION_APPROVAL_ENV,
  SMS_OTP_SCHEMA_MIGRATION,
  SMS_OTP_SCHEMA_RECONCILIATION_TARGET,
  SUPPORTED_UTF8MB4_COLLATIONS,
  classifyPreconditionReason,
  classifySmsOtpSchema,
  createPhoneVerificationChallengeSchema,
  createPleskSmsOtpSchemaReconciliationRunner,
  inspectSmsOtpSchema,
  userColumnsReasonDetail,
  userTableReasonDetail
} = require("../../scripts/plesk-sms-otp-schema-reconciliation.cjs");

const supportedUtf8mb4Collations = [...SUPPORTED_UTF8MB4_COLLATIONS] as string[];

type SchemaState = {
  migration: "applied" | "not_applied" | "unexpected";
  user: "ready" | "not_ready";
  challenge: "absent" | "ready" | "partial_or_unexpected";
  reasonComponent?:
    | "migration_state"
    | "user_table"
    | "user_columns"
    | "user_indexes"
    | "challenge_absence"
    | "inspection"
    | null;
  reasonDetail?:
    | "missing"
    | "wrong_type"
    | "metadata_unavailable"
    | "collation_incompatible"
    | "unsupported_collation"
    | "full_name_missing";
  userIdCollation?: string;
};

const exactPartialState: SchemaState = {
  migration: "not_applied",
  user: "ready",
  challenge: "absent",
  userIdCollation: "utf8mb4_unicode_ci"
};
const parityBeforeResolve: SchemaState = {
  migration: "not_applied",
  user: "ready",
  challenge: "ready",
  userIdCollation: "utf8mb4_unicode_ci"
};
const fullyReadyState: SchemaState = {
  migration: "applied",
  user: "ready",
  challenge: "ready",
  userIdCollation: "utf8mb4_unicode_ci"
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
  const writeStatus = vi.fn();
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
      writeStatus,
      ...loggers
    },
    spawnSync,
    writeStatus
  };
}

function withInspector(bundle: ReturnType<typeof createOptions>) {
  return { ...bundle.options, inspectSchema: bundle.inspectSchema };
}

function serializedLogs(loggers: ReturnType<typeof createLoggers>) {
  return [...loggers.logs, ...loggers.errors].join("\n");
}

function userColumns(userIdCollation = "utf8mb4_unicode_ci") {
  return [
    {
      name: "id",
      dataType: "varchar",
      isNullable: "NO",
      characterLength: 191,
      datetimePrecision: null,
      defaultValue: null,
      characterSetName: "utf8mb4",
      collationName: userIdCollation
    },
    {
      name: "fullName",
      dataType: "varchar",
      isNullable: "YES",
      characterLength: 191,
      datetimePrecision: null,
      defaultValue: null,
      characterSetName: "utf8mb4",
      collationName: userIdCollation
    },
    {
      name: "dateOfBirth",
      dataType: "date",
      isNullable: "YES",
      characterLength: null,
      datetimePrecision: null,
      defaultValue: null,
      characterSetName: null,
      collationName: null
    },
    {
      name: "normalizedPhone",
      dataType: "varchar",
      isNullable: "YES",
      characterLength: 20,
      datetimePrecision: null,
      defaultValue: null,
      characterSetName: "utf8mb4",
      collationName: userIdCollation
    },
    {
      name: "phoneVerifiedAt",
      dataType: "datetime",
      isNullable: "YES",
      characterLength: null,
      datetimePrecision: 3,
      defaultValue: null,
      characterSetName: null,
      collationName: null
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

function challengeColumns(userIdCollation = "utf8mb4_unicode_ci") {
  const column = (
    name: string,
    dataType: string,
    isNullable: "YES" | "NO",
    options: {
      characterLength?: number;
      datetimePrecision?: number;
      defaultValue?: string | null;
      characterSetName?: string;
      collationName?: string;
    } = {}
  ) => ({
    name,
    dataType,
    isNullable,
    characterLength: options.characterLength ?? null,
    datetimePrecision: options.datetimePrecision ?? null,
    defaultValue: Object.prototype.hasOwnProperty.call(options, "defaultValue") ? options.defaultValue : null,
    characterSetName: options.characterSetName ?? null,
    collationName: options.collationName ?? null
  });

  return [
    column("id", "varchar", "NO", {
      characterLength: 191,
      characterSetName: "utf8mb4",
      collationName: userIdCollation
    }),
    column("userId", "varchar", "NO", {
      characterLength: 191,
      characterSetName: "utf8mb4",
      collationName: userIdCollation
    }),
    column("normalizedPhone", "varchar", "NO", {
      characterLength: 20,
      characterSetName: "utf8mb4",
      collationName: userIdCollation
    }),
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

function rawSnapshot({
  applied = false,
  challenge = false,
  userIdCollation = "utf8mb4_unicode_ci",
  challengeCollation
}: {
  applied?: boolean;
  challenge?: boolean;
  userIdCollation?: string;
  challengeCollation?: string;
} = {}) {
  const resolvedChallengeCollation = challengeCollation ?? userIdCollation;
  return {
    migrations: applied ? [{ name: SMS_OTP_SCHEMA_MIGRATION, finished: 1, rolledBack: 0 }] : [],
    userTables: [
      {
        name: "User",
        tableType: "BASE TABLE",
        tableCollation: userIdCollation
      }
    ],
    userColumns: userColumns(userIdCollation),
    userIndexes: userIndexes(),
    challengeTables: challenge
      ? [
          {
            name: "PhoneVerificationChallenge",
            tableType: "BASE TABLE",
            tableCollation: resolvedChallengeCollation
          }
        ]
      : [],
    challengeColumns: challenge ? challengeColumns(resolvedChallengeCollation) : [],
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
        writeStatus: vi.fn(),
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
      validateSource: vi.fn(() => true),
      writeStatus: vi.fn()
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
      validateSource: vi.fn(() => false),
      writeStatus: vi.fn()
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
    expect(bundle.createSchema).toHaveBeenCalledWith(bundle.client, "utf8mb4_unicode_ci");
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
    expect(bundle.writeStatus.mock.calls.map(([status]) => status.eventName)).toEqual([
      "dispatch_started",
      "source_accepted",
      "inspection_started",
      "precondition_accepted",
      "schema_creation_started",
      "schema_creation_ready",
      "parity_before_resolve_ready",
      "migration_resolve_started",
      "migration_resolve_ready",
      "complete_ready"
    ]);
    expect(bundle.client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails closed before database access when private status diagnostics are unavailable", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const createClientMock = vi.fn();
    const loggers = createLoggers();

    const result = await runner({
      rootDir: "C:/approved-runtime",
      env: approvedEnv(),
      createClient: createClientMock,
      writeStatus: vi.fn(() => {
        throw new Error("private-password private-host");
      }),
      ...loggers
    });

    expect(result).toEqual({
      outcome: "diagnostics_unavailable",
      shouldStart: false,
      reconciliationRun: false
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(serializedLogs(loggers)).toBe(
      "[sms-otp-reconciliation] stage=diagnostics status=unavailable"
    );
  });

  it("stops before migrate resolve when diagnostics fail after schema creation", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState]);
    bundle.writeStatus.mockImplementation(({ eventName }) => {
      if (eventName === "schema_creation_ready") {
        throw new Error("private-password private-host");
      }
    });

    const result = await runner(withInspector(bundle));

    expect(result).toEqual({
      outcome: "diagnostics_unavailable",
      shouldStart: false,
      reconciliationRun: true
    });
    expect(bundle.createSchema).toHaveBeenCalledTimes(1);
    expect(bundle.spawnSync).not.toHaveBeenCalled();
    expect(serializedLogs(bundle.loggers)).not.toContain("private-password");
    expect(serializedLogs(bundle.loggers)).not.toContain("private-host");
  });

  it.each([
    ["already ready", { ...fullyReadyState, reasonComponent: "migration_state" }, "migration_state"],
    [
      "migration applied but challenge table missing",
      { ...exactPartialState, migration: "applied", reasonComponent: "migration_state" },
      "migration_state"
    ],
    [
      "partial challenge table state",
      { ...exactPartialState, challenge: "partial_or_unexpected", reasonComponent: "challenge_absence" },
      "challenge_absence"
    ],
    [
      "required User component missing",
      {
        ...exactPartialState,
        user: "not_ready",
        reasonComponent: "user_columns",
        reasonDetail: "full_name_missing"
      },
      "user_columns"
    ],
    [
      "User table collation mismatch",
      {
        ...exactPartialState,
        user: "not_ready",
        reasonComponent: "user_table",
        reasonDetail: "collation_incompatible"
      },
      "user_table"
    ]
  ] as const)("fails closed for %s", async (_label, precondition, expectedReason) => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([precondition as SchemaState]);

    const result = await runner(withInspector(bundle));

    expect(result.outcome).toBe("precondition_rejected");
    expect(result.shouldStart).toBe(false);
    expect(bundle.createSchema).not.toHaveBeenCalled();
    expect(bundle.spawnSync).not.toHaveBeenCalled();
    expect(bundle.writeStatus).toHaveBeenCalledWith({
      rootDir: bundle.options.rootDir,
      eventName: "precondition_rejected",
      reasonComponent: expectedReason,
      ...(expectedReason === "user_table"
        ? { reasonDetail: "collation_incompatible" }
        : expectedReason === "user_columns"
          ? { reasonDetail: "full_name_missing" }
          : {})
    });
  });

  it("fails closed for unsupported injection-shaped metadata without emitting the raw value", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const rawCollation = "utf8mb4_unicode_ci; DROP TABLE User";
    const bundle = createOptions([
      {
        ...exactPartialState,
        user: "not_ready",
        reasonComponent: "user_table",
        reasonDetail: "unsupported_collation",
        userIdCollation: rawCollation
      }
    ]);

    const result = await runner(withInspector(bundle));

    expect(result.outcome).toBe("precondition_rejected");
    expect(bundle.createSchema).not.toHaveBeenCalled();
    expect(bundle.spawnSync).not.toHaveBeenCalled();
    expect(bundle.writeStatus).toHaveBeenCalledWith({
      rootDir: bundle.options.rootDir,
      eventName: "precondition_rejected",
      reasonComponent: "user_table",
      reasonDetail: "unsupported_collation"
    });
    expect(serializedLogs(bundle.loggers)).not.toContain(rawCollation);
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

  it("marks an inspection failure after DDL as a reconciliation run and never resolves", async () => {
    const runner = createPleskSmsOtpSchemaReconciliationRunner();
    const bundle = createOptions([exactPartialState, new Error("private-password private-host")]);

    const result = await runner(withInspector(bundle));

    expect(result).toEqual({
      outcome: "inspection_unavailable",
      shouldStart: false,
      reconciliationRun: true
    });
    expect(bundle.createSchema).toHaveBeenCalledTimes(1);
    expect(bundle.spawnSync).not.toHaveBeenCalled();
    expect(bundle.writeStatus).toHaveBeenLastCalledWith({
      rootDir: bundle.options.rootDir,
      eventName: "inspection_unavailable"
    });
    expect(serializedLogs(bundle.loggers)).not.toContain("private-password");
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
    expect(classifySmsOtpSchema(rawSnapshot())).toEqual({
      migration: "not_applied",
      user: "ready",
      challenge: "absent"
    });
    expect(classifySmsOtpSchema(rawSnapshot({ applied: true, challenge: true }))).toEqual({
      migration: "applied",
      user: "ready",
      challenge: "ready"
    });
  });

  it.each([
    [
      "migration_state",
      (snapshot: ReturnType<typeof rawSnapshot>) =>
        snapshot.migrations.push({ name: SMS_OTP_SCHEMA_MIGRATION, finished: 1, rolledBack: 0 })
    ],
    [
      "user_table",
      (snapshot: ReturnType<typeof rawSnapshot>) => {
        snapshot.userTables[0].tableCollation = "utf8mb4_general_ci";
      }
    ],
    [
      "user_columns",
      (snapshot: ReturnType<typeof rawSnapshot>) => {
        snapshot.userColumns = snapshot.userColumns.filter((row) => row.name !== "fullName");
      }
    ],
    [
      "user_indexes",
      (snapshot: ReturnType<typeof rawSnapshot>) => {
        snapshot.userIndexes = snapshot.userIndexes.slice(0, 1);
      }
    ],
    [
      "challenge_absence",
      (snapshot: ReturnType<typeof rawSnapshot>) => Object.assign(snapshot, rawSnapshot({ challenge: true }))
    ]
  ] as const)("classifies the closed precondition reason %s", (expectedReason, mutate) => {
    const snapshot = rawSnapshot();
    mutate(snapshot);

    expect(classifyPreconditionReason(snapshot)).toBe(expectedReason);
  });

  it.each([
    ["missing", (snapshot: ReturnType<typeof rawSnapshot>) => (snapshot.userTables = [])],
    [
      "wrong_type",
      (snapshot: ReturnType<typeof rawSnapshot>) => {
        snapshot.userTables[0].tableType = "VIEW";
      }
    ],
    [
      "metadata_unavailable",
      (snapshot: ReturnType<typeof rawSnapshot>) => {
        snapshot.userColumns[0].collationName = null as unknown as string;
      }
    ],
    [
      "collation_incompatible",
      (snapshot: ReturnType<typeof rawSnapshot>) => {
        snapshot.userTables[0].tableCollation = "utf8mb4_general_ci";
      }
    ],
    [
      "unsupported_collation",
      (snapshot: ReturnType<typeof rawSnapshot>) => {
        snapshot.userTables[0].tableCollation = "utf8mb4_injection_ci";
        snapshot.userColumns[0].collationName = "utf8mb4_injection_ci";
      }
    ]
  ] as const)("classifies the closed User table reason detail %s", (expectedReason, mutate) => {
    const snapshot = rawSnapshot();
    mutate(snapshot);

    expect(userTableReasonDetail(snapshot)).toBe(expectedReason);
    expect(classifyPreconditionReason(snapshot)).toBe("user_table");
  });

  it.each([
    ["id", "id_missing"],
    ["fullName", "full_name_missing"],
    ["dateOfBirth", "date_of_birth_missing"],
    ["normalizedPhone", "normalized_phone_missing"],
    ["phoneVerifiedAt", "phone_verified_at_missing"]
  ] as const)("classifies a missing %s User column without exposing metadata", (columnName, expected) => {
    const snapshot = rawSnapshot();
    snapshot.userColumns = snapshot.userColumns.filter((row) => row.name !== columnName);

    expect(userColumnsReasonDetail(snapshot)).toBe(expected);
    expect(classifyPreconditionReason(snapshot)).toBe("user_columns");
  });

  it.each([
    ["id_length", "id", "characterLength", 190],
    ["full_name_type", "fullName", "dataType", "text"],
    ["date_of_birth_nullability", "dateOfBirth", "isNullable", "NO"],
    ["normalized_phone_default", "normalizedPhone", "defaultValue", "'NULL'"],
    ["phone_verified_at_precision", "phoneVerifiedAt", "datetimePrecision", 0]
  ] as const)("classifies the closed User column mismatch %s", (expected, columnName, field, value) => {
    const snapshot = rawSnapshot();
    const column = snapshot.userColumns.find((row) => row.name === columnName);
    if (!column) throw new Error("test fixture is missing a User column");
    Object.assign(column, { [field]: value });

    expect(userColumnsReasonDetail(snapshot)).toBe(expected);
    expect(classifyPreconditionReason(snapshot)).toBe("user_columns");
  });

  it("accepts MariaDB's unquoted NULL metadata for nullable columns but not for User.id", () => {
    const snapshot = rawSnapshot();
    for (const column of snapshot.userColumns) {
      if (column.isNullable === "YES") {
        (column as { defaultValue: string | null }).defaultValue = "NULL";
      }
    }

    expect(userColumnsReasonDetail(snapshot)).toBeNull();
    expect(classifyPreconditionReason(snapshot)).toBeNull();

    (snapshot.userColumns[0] as { defaultValue: string | null }).defaultValue = "NULL";
    expect(userColumnsReasonDetail(snapshot)).toBe("id_default");
    expect(classifyPreconditionReason(snapshot)).toBe("user_columns");
  });

  it("preserves post-create parity for MariaDB's unquoted NULL on nullable challenge columns", () => {
    const snapshot = rawSnapshot({ applied: true, challenge: true });
    for (const column of snapshot.userColumns) {
      if (column.isNullable === "YES") {
        (column as { defaultValue: string | null }).defaultValue = "NULL";
      }
    }
    const verifiedAt = snapshot.challengeColumns.find((row) => row.name === "verifiedAt");
    if (!verifiedAt) throw new Error("test fixture is missing verifiedAt");
    verifiedAt.defaultValue = "NULL";

    expect(classifySmsOtpSchema(snapshot)).toEqual({
      migration: "applied",
      user: "ready",
      challenge: "ready"
    });
  });

  it("fails closed with a safe fallback when User column metadata is duplicated", () => {
    const snapshot = rawSnapshot();
    snapshot.userColumns.push({ ...snapshot.userColumns[0] });

    expect(userColumnsReasonDetail(snapshot)).toBe("metadata_unavailable");
    expect(classifyPreconditionReason(snapshot)).toBe("user_columns");
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

    await expect(inspectSmsOtpSchema(client)).resolves.toEqual({
      ...exactPartialState,
      reasonComponent: null
    });
    expect(client.$queryRaw).toHaveBeenCalledTimes(8);
  });

  it("maps an exact User column mismatch to only the closed reason detail", async () => {
    const snapshot = rawSnapshot();
    const fullName = snapshot.userColumns.find((row) => row.name === "fullName");
    if (!fullName) throw new Error("test fixture is missing fullName");
    fullName.characterLength = 255;
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
    const client = { $queryRaw: vi.fn(async () => queryResults.shift()) };

    await expect(inspectSmsOtpSchema(client)).resolves.toEqual({
      migration: "not_applied",
      user: "not_ready",
      challenge: "absent",
      reasonComponent: "user_columns",
      reasonDetail: "full_name_length"
    });
    expect(client.$queryRaw).toHaveBeenCalledTimes(8);
  });

  it("retains the allowlisted User.id collation for post-create and final parity inspection", async () => {
    const snapshot = rawSnapshot({ challenge: true });
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

    await expect(inspectSmsOtpSchema(client)).resolves.toEqual({
      ...parityBeforeResolve,
      reasonComponent: "challenge_absence"
    });
    expect(client.$queryRaw).toHaveBeenCalledTimes(8);
  });

  it("ignores the database default when the supported User and User.id collations match", () => {
    const snapshot = rawSnapshot();
    Object.assign(snapshot.userTables[0], { databaseCollation: "utf8mb4_general_ci" });

    expect(userTableReasonDetail(snapshot)).toBeNull();
    expect(classifyPreconditionReason(snapshot)).toBeNull();
  });

  it.each(supportedUtf8mb4Collations)(
    "uses a static %s DDL statement for only the empty challenge table dependency stack",
    async (collation) => {
      const client = { $executeRaw: vi.fn().mockResolvedValue(0) };

      await createPhoneVerificationChallengeSchema(client, collation);

      expect(client.$executeRaw).toHaveBeenCalledTimes(1);
      const query = client.$executeRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
      expect(query.values).toEqual([]);
      expect(query.sql).toContain("CREATE TABLE `PhoneVerificationChallenge`");
      expect(query.sql).toContain(`DEFAULT CHARACTER SET utf8mb4 COLLATE ${collation}`);
      expect(query.sql).toContain("PhoneVerificationChallenge_userId_expiresAt_idx");
      expect(query.sql).toContain("PhoneVerificationChallenge_userId_requestedAt_idx");
      expect(query.sql).toContain("PhoneVerificationChallenge_userId_fkey");
      expect(query.sql).not.toContain("ALTER TABLE `User`");
      expect(query.sql).not.toContain("INSERT INTO");
      expect(query.sql).not.toContain("UPDATE `User`");
    }
  );

  it("rejects injection-shaped collation metadata before executing DDL", async () => {
    const client = { $executeRaw: vi.fn().mockResolvedValue(0) };

    await expect(
      createPhoneVerificationChallengeSchema(client, "utf8mb4_unicode_ci; DROP TABLE User")
    ).rejects.toThrow("collation is not allowlisted");
    expect(client.$executeRaw).not.toHaveBeenCalled();
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

  it("fails parity when the challenge FK column collation differs from User.id", () => {
    const snapshot = rawSnapshot({ applied: true, challenge: true });
    const challengeUserId = snapshot.challengeColumns.find((row) => row.name === "userId");
    if (!challengeUserId) throw new Error("test fixture is missing challenge userId");
    challengeUserId.collationName = "utf8mb4_general_ci";

    expect(classifySmsOtpSchema(snapshot).challenge).toBe("partial_or_unexpected");
  });
});
