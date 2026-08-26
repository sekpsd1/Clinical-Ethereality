/* eslint-disable @typescript-eslint/no-require-imports */
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  MIGRATION_APPROVAL_ENV,
  getCurrentMigrationTarget
} = require("./plesk-runtime-migration-runner.cjs");

const SMS_OTP_SCHEMA_MIGRATION = "20260814090000_add_patient_phone_verification";
const RECONCILIATION_APPROVAL_ENV = "PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET";
const SMS_OTP_SCHEMA_RECONCILIATION_TARGET = `${SMS_OTP_SCHEMA_MIGRATION}:partial-schema-v1`;
const EXPECTED_MIGRATION_SHA256 = "9e791f7de3090020269e4e357d969e0a3547fa5db194d132087fdbd3709f0000";

const REQUIRED_USER_COLUMNS = {
  id: { dataType: "varchar", nullable: false, characterLength: 191, defaultValue: null },
  fullName: { dataType: "varchar", nullable: true, characterLength: 191, defaultValue: null },
  dateOfBirth: { dataType: "date", nullable: true, defaultValue: null },
  normalizedPhone: { dataType: "varchar", nullable: true, characterLength: 20, defaultValue: null },
  phoneVerifiedAt: { dataType: "datetime", nullable: true, datetimePrecision: 3, defaultValue: null }
};

const REQUIRED_CHALLENGE_COLUMNS = {
  id: { dataType: "varchar", nullable: false, characterLength: 191, defaultValue: null },
  userId: { dataType: "varchar", nullable: false, characterLength: 191, defaultValue: null },
  normalizedPhone: { dataType: "varchar", nullable: false, characterLength: 20, defaultValue: null },
  providerChallengeCiphertext: { dataType: "text", nullable: false, defaultValue: null },
  expiresAt: { dataType: "datetime", nullable: false, datetimePrecision: 3, defaultValue: null },
  attemptCount: { dataType: "int", nullable: false, defaultValue: "0" },
  requestedAt: {
    dataType: "datetime",
    nullable: false,
    datetimePrecision: 3,
    defaultValue: "current_timestamp(3)"
  },
  verifiedAt: { dataType: "datetime", nullable: true, datetimePrecision: 3, defaultValue: null },
  createdAt: {
    dataType: "datetime",
    nullable: false,
    datetimePrecision: 3,
    defaultValue: "current_timestamp(3)"
  },
  updatedAt: { dataType: "datetime", nullable: false, datetimePrecision: 3, defaultValue: null }
};

function hasOwn(env, key) {
  return Object.prototype.hasOwnProperty.call(env, key);
}

function hasReconciliationTarget(env = process.env) {
  return hasOwn(env, RECONCILIATION_APPROVAL_ENV);
}

function isAllowedReconciliationTarget(target) {
  return target === SMS_OTP_SCHEMA_RECONCILIATION_TARGET;
}

function asBoolean(value) {
  return value === true || value === 1 || value === BigInt(1) || value === "1";
}

function asNumber(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function normalizeDefault(value) {
  if (value === null || value === undefined) return null;
  return String(value).toLowerCase();
}

function hasExactColumns(rows, expected) {
  if (rows.length !== Object.keys(expected).length) return false;

  const byName = new Map(rows.map((row) => [row.name, row]));
  if (byName.size !== rows.length) return false;

  return Object.entries(expected).every(([name, requirement]) => {
    const row = byName.get(name);
    if (!row) return false;
    if (normalizeText(row.dataType) !== requirement.dataType) return false;
    if ((normalizeText(row.isNullable) === "yes") !== requirement.nullable) return false;
    if (
      Object.prototype.hasOwnProperty.call(requirement, "characterLength") &&
      asNumber(row.characterLength) !== requirement.characterLength
    ) {
      return false;
    }
    if (
      Object.prototype.hasOwnProperty.call(requirement, "datetimePrecision") &&
      asNumber(row.datetimePrecision) !== requirement.datetimePrecision
    ) {
      return false;
    }
    if (
      Object.prototype.hasOwnProperty.call(requirement, "defaultValue") &&
      normalizeDefault(row.defaultValue) !== requirement.defaultValue
    ) {
      return false;
    }
    return true;
  });
}

function hasExactIndex(rows, indexName, columns, unique) {
  const matching = rows
    .filter((row) => row.indexName === indexName)
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));

  return (
    matching.length === columns.length &&
    matching.every(
      (row, index) =>
        row.columnName === columns[index] &&
        Number(row.sequence) === index + 1 &&
        Number(row.nonUnique) === (unique ? 0 : 1) &&
        normalizeText(row.indexType) === "btree"
    )
  );
}

function migrationState(rows) {
  if (rows.length === 0) return "not_applied";
  if (rows.some((row) => row.name !== SMS_OTP_SCHEMA_MIGRATION)) return "unexpected";
  return rows.some((row) => asBoolean(row.finished) && !asBoolean(row.rolledBack))
    ? "applied"
    : "not_applied";
}

function userState(snapshot) {
  const tableReady =
    snapshot.userTables.length === 1 &&
    snapshot.userTables[0].name === "User" &&
    normalizeText(snapshot.userTables[0].tableType) === "base table" &&
    typeof snapshot.userTables[0].tableCollation === "string" &&
    snapshot.userTables[0].tableCollation === snapshot.userTables[0].databaseCollation;
  const columnsReady = hasExactColumns(snapshot.userColumns, REQUIRED_USER_COLUMNS);
  const indexesReady =
    snapshot.userIndexes.length === 2 &&
    hasExactIndex(snapshot.userIndexes, "User_normalizedPhone_key", ["normalizedPhone"], true) &&
    hasExactIndex(snapshot.userIndexes, "User_phoneVerifiedAt_idx", ["phoneVerifiedAt"], false);
  return tableReady && columnsReady && indexesReady ? "ready" : "not_ready";
}

function challengeState(snapshot) {
  const metadataCounts = [
    snapshot.challengeTables.length,
    snapshot.challengeColumns.length,
    snapshot.challengeIndexes.length,
    snapshot.challengeForeignKeys.length
  ];

  if (metadataCounts.every((count) => count === 0)) return "absent";

  const tableReady =
    snapshot.challengeTables.length === 1 &&
    snapshot.challengeTables[0].name === "PhoneVerificationChallenge" &&
    normalizeText(snapshot.challengeTables[0].tableType) === "base table" &&
    snapshot.userTables.length === 1 &&
    snapshot.challengeTables[0].tableCollation === snapshot.userTables[0].tableCollation;
  const columnsReady = hasExactColumns(snapshot.challengeColumns, REQUIRED_CHALLENGE_COLUMNS);
  const indexesReady =
    snapshot.challengeIndexes.length === 5 &&
    hasExactIndex(snapshot.challengeIndexes, "PRIMARY", ["id"], true) &&
    hasExactIndex(
      snapshot.challengeIndexes,
      "PhoneVerificationChallenge_userId_expiresAt_idx",
      ["userId", "expiresAt"],
      false
    ) &&
    hasExactIndex(
      snapshot.challengeIndexes,
      "PhoneVerificationChallenge_userId_requestedAt_idx",
      ["userId", "requestedAt"],
      false
    );
  const foreignKeyReady =
    snapshot.challengeForeignKeys.length === 1 &&
    snapshot.challengeForeignKeys[0].constraintName === "PhoneVerificationChallenge_userId_fkey" &&
    snapshot.challengeForeignKeys[0].tableName === "PhoneVerificationChallenge" &&
    snapshot.challengeForeignKeys[0].columnName === "userId" &&
    snapshot.challengeForeignKeys[0].referencedTableName === "User" &&
    snapshot.challengeForeignKeys[0].referencedColumnName === "id" &&
    normalizeText(snapshot.challengeForeignKeys[0].updateRule) === "cascade" &&
    normalizeText(snapshot.challengeForeignKeys[0].deleteRule) === "cascade";

  return tableReady && columnsReady && indexesReady && foreignKeyReady ? "ready" : "partial_or_unexpected";
}

function classifySmsOtpSchema(snapshot) {
  return {
    migration: migrationState(snapshot.migrations),
    user: userState(snapshot),
    challenge: challengeState(snapshot)
  };
}

async function inspectSmsOtpSchema(client) {
  const { Prisma } = require("@prisma/client");
  const [
    userTables,
    migrations,
    userColumns,
    userIndexes,
    challengeTables,
    challengeColumns,
    challengeIndexes,
    challengeForeignKeys
  ] = await Promise.all([
    client.$queryRaw(Prisma.sql`
      SELECT
        tables.TABLE_NAME AS name,
        tables.TABLE_TYPE AS tableType,
        tables.TABLE_COLLATION AS tableCollation,
        schemata.DEFAULT_COLLATION_NAME AS databaseCollation
      FROM INFORMATION_SCHEMA.TABLES AS tables
      INNER JOIN INFORMATION_SCHEMA.SCHEMATA AS schemata
        ON schemata.SCHEMA_NAME = tables.TABLE_SCHEMA
      WHERE tables.TABLE_SCHEMA = DATABASE()
        AND tables.TABLE_NAME = 'User'
    `),
    client.$queryRaw(Prisma.sql`
      SELECT
        migration_name AS name,
        finished_at IS NOT NULL AS finished,
        rolled_back_at IS NOT NULL AS rolledBack
      FROM _prisma_migrations
      WHERE migration_name = ${SMS_OTP_SCHEMA_MIGRATION}
    `),
    client.$queryRaw(Prisma.sql`
      SELECT
        COLUMN_NAME AS name,
        DATA_TYPE AS dataType,
        IS_NULLABLE AS isNullable,
        CHARACTER_MAXIMUM_LENGTH AS characterLength,
        DATETIME_PRECISION AS datetimePrecision,
        COLUMN_DEFAULT AS defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'User'
        AND COLUMN_NAME IN ('id', 'fullName', 'dateOfBirth', 'normalizedPhone', 'phoneVerifiedAt')
    `),
    client.$queryRaw(Prisma.sql`
      SELECT
        INDEX_NAME AS indexName,
        NON_UNIQUE AS nonUnique,
        SEQ_IN_INDEX AS sequence,
        COLUMN_NAME AS columnName,
        INDEX_TYPE AS indexType
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'User'
        AND INDEX_NAME IN ('User_normalizedPhone_key', 'User_phoneVerifiedAt_idx')
    `),
    client.$queryRaw(Prisma.sql`
      SELECT TABLE_NAME AS name, TABLE_TYPE AS tableType, TABLE_COLLATION AS tableCollation
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'PhoneVerificationChallenge'
    `),
    client.$queryRaw(Prisma.sql`
      SELECT
        COLUMN_NAME AS name,
        DATA_TYPE AS dataType,
        IS_NULLABLE AS isNullable,
        CHARACTER_MAXIMUM_LENGTH AS characterLength,
        DATETIME_PRECISION AS datetimePrecision,
        COLUMN_DEFAULT AS defaultValue
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'PhoneVerificationChallenge'
    `),
    client.$queryRaw(Prisma.sql`
      SELECT
        INDEX_NAME AS indexName,
        NON_UNIQUE AS nonUnique,
        SEQ_IN_INDEX AS sequence,
        COLUMN_NAME AS columnName,
        INDEX_TYPE AS indexType
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'PhoneVerificationChallenge'
    `),
    client.$queryRaw(Prisma.sql`
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
    `)
  ]);

  return classifySmsOtpSchema({
    migrations,
    userTables,
    userColumns,
    userIndexes,
    challengeTables,
    challengeColumns,
    challengeIndexes,
    challengeForeignKeys
  });
}

async function createPhoneVerificationChallengeSchema(client) {
  const { Prisma } = require("@prisma/client");
  await client.$executeRaw(Prisma.sql`
    CREATE TABLE \`PhoneVerificationChallenge\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`userId\` VARCHAR(191) NOT NULL,
      \`normalizedPhone\` VARCHAR(20) NOT NULL,
      \`providerChallengeCiphertext\` TEXT NOT NULL,
      \`expiresAt\` DATETIME(3) NOT NULL,
      \`attemptCount\` INTEGER NOT NULL DEFAULT 0,
      \`requestedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`verifiedAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`PhoneVerificationChallenge_userId_expiresAt_idx\` (\`userId\`, \`expiresAt\`),
      INDEX \`PhoneVerificationChallenge_userId_requestedAt_idx\` (\`userId\`, \`requestedAt\`),
      CONSTRAINT \`PhoneVerificationChallenge_userId_fkey\`
        FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
}

function validateReconciliationSource(rootDir) {
  const migrationPath = path.join(
    rootDir,
    "prisma",
    "migrations",
    SMS_OTP_SCHEMA_MIGRATION,
    "migration.sql"
  );
  const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");

  if (
    !fs.existsSync(migrationPath) ||
    !fs.existsSync(prismaCli) ||
    getCurrentMigrationTarget(rootDir) !== SMS_OTP_SCHEMA_MIGRATION
  ) {
    return false;
  }

  const canonicalMigration = fs.readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");
  const actualHash = crypto.createHash("sha256").update(canonicalMigration).digest("hex");
  return actualHash === EXPECTED_MIGRATION_SHA256;
}

function defaultCreateClient() {
  const { PrismaClient } = require("@prisma/client");
  return new PrismaClient({ log: [] });
}

function safeResult(outcome, { shouldStart = false, reconciliationRun = false } = {}) {
  return { outcome, shouldStart, reconciliationRun };
}

function createPleskSmsOtpSchemaReconciliationRunner() {
  let attempted = false;

  return async function runPleskSmsOtpSchemaReconciliation({
    rootDir,
    env = process.env,
    createClient = defaultCreateClient,
    inspectSchema = inspectSmsOtpSchema,
    createSchema = createPhoneVerificationChallengeSchema,
    validateSource = validateReconciliationSource,
    spawnSync = childProcess.spawnSync,
    log = console.log,
    error = console.error
  }) {
    if (!hasReconciliationTarget(env)) {
      return safeResult("not_requested", { shouldStart: true });
    }

    if (attempted) {
      error("[sms-otp-reconciliation] stage=dispatch status=rejected_duplicate");
      return safeResult("duplicate_rejected");
    }
    attempted = true;

    if (!isAllowedReconciliationTarget(env[RECONCILIATION_APPROVAL_ENV])) {
      error("[sms-otp-reconciliation] stage=target status=rejected");
      return safeResult("target_rejected");
    }

    if (hasOwn(env, MIGRATION_APPROVAL_ENV)) {
      error("[sms-otp-reconciliation] stage=target status=conflict");
      return safeResult("target_conflict");
    }

    if (!validateSource(rootDir)) {
      error("[sms-otp-reconciliation] stage=source status=rejected");
      return safeResult("source_rejected");
    }

    const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
    let client;

    try {
      client = createClient();
      const precondition = await inspectSchema(client);
      if (
        precondition.migration !== "not_applied" ||
        precondition.user !== "ready" ||
        precondition.challenge !== "absent"
      ) {
        error("[sms-otp-reconciliation] stage=precondition status=rejected");
        return safeResult("precondition_rejected");
      }

      log("[sms-otp-reconciliation] stage=precondition status=accepted");

      try {
        await createSchema(client);
      } catch {
        error("[sms-otp-reconciliation] stage=schema_creation status=failed");
        return safeResult("schema_creation_failed", { reconciliationRun: true });
      }

      const parityBeforeResolve = await inspectSchema(client);
      if (
        parityBeforeResolve.migration !== "not_applied" ||
        parityBeforeResolve.user !== "ready" ||
        parityBeforeResolve.challenge !== "ready"
      ) {
        error("[sms-otp-reconciliation] stage=parity_before_resolve status=failed");
        return safeResult("parity_failed", { reconciliationRun: true });
      }

      log("[sms-otp-reconciliation] stage=parity_before_resolve status=ready");

      const resolveResult = spawnSync(
        process.execPath,
        [prismaCli, "migrate", "resolve", "--applied", SMS_OTP_SCHEMA_MIGRATION],
        {
          cwd: rootDir,
          encoding: "utf8",
          env,
          shell: false,
          stdio: "ignore",
          windowsHide: true
        }
      );

      if (resolveResult.error || resolveResult.status !== 0) {
        error("[sms-otp-reconciliation] stage=migration_resolve status=failed");
        return safeResult("migration_resolve_failed", { reconciliationRun: true });
      }

      const finalParity = await inspectSchema(client);
      if (
        finalParity.migration !== "applied" ||
        finalParity.user !== "ready" ||
        finalParity.challenge !== "ready"
      ) {
        error("[sms-otp-reconciliation] stage=final_parity status=failed");
        return safeResult("final_parity_failed", { reconciliationRun: true });
      }

      log("[sms-otp-reconciliation] stage=complete status=ready action=remove_target_and_restart");
      return safeResult("completed", { reconciliationRun: true });
    } catch {
      error("[sms-otp-reconciliation] stage=inspection status=unavailable");
      return safeResult("inspection_unavailable");
    } finally {
      if (client) {
        try {
          await client.$disconnect();
        } catch {
          // Disconnect failures do not expose details and never change the fail-closed result.
        }
      }
    }
  };
}

const runPleskSmsOtpSchemaReconciliation = createPleskSmsOtpSchemaReconciliationRunner();

module.exports = {
  EXPECTED_MIGRATION_SHA256,
  RECONCILIATION_APPROVAL_ENV,
  SMS_OTP_SCHEMA_MIGRATION,
  SMS_OTP_SCHEMA_RECONCILIATION_TARGET,
  classifySmsOtpSchema,
  createPhoneVerificationChallengeSchema,
  createPleskSmsOtpSchemaReconciliationRunner,
  hasReconciliationTarget,
  inspectSmsOtpSchema,
  isAllowedReconciliationTarget,
  runPleskSmsOtpSchemaReconciliation,
  validateReconciliationSource
};
