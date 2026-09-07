/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const TEST_APP_URL = "https://test-app.bccgroup-thailand.com";
const TEST_LINE_CALLBACK_URL = TEST_APP_URL + "/api/auth/line/callback";
const TEST_ZOOM_WEBHOOK_URL = TEST_APP_URL + "/api/webhooks/zoom";
const TEST_DEPLOYMENT_MARKER = "test";
const FIXTURE_PREFIX = "[TEST] Isolated non-monetary LINE-to-Zoom UAT";
const FIXTURE_ACTION_CREATED = "consultation.zoom_test_fixture_created";
const FIXTURE_ACTION_CANCELLED = "consultation.zoom_test_fixture_cancelled";
const FIXTURE_DURATION_MINUTES = 30;
const MAX_SUPPORTED_BOOKED_DURATION_MINUTES = 720;
const MAX_FUTURE_SLOT_DAYS = 30;
const MAX_TARGET_CANDIDATES = 100;
const RUNNER_MODES = new Set(["precheck", "create", "verify", "cleanup"]);
const ALLOWED_VERIFY_STATUSES = new Set(["scheduled", "live", "cancelled"]);
const ALLOWED_ZOOM_STATES = new Set(["absent", "present"]);
const ACTIVE_CONSULTATION_STATUSES = ["requested", "pending_payment", "scheduled", "live"];
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const FIXTURE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,80}$/;
const TEST_IDENTITY_PATTERN = /(?:^|[_-])(?:test|uat|staging)(?:[_-]|$)/i;
const PRODUCTION_IDENTITY_PATTERN = /(?:^|[_-])(?:prod|production|main)(?:[_-]|$)|app2026/i;

const REQUIRED_ZOOM_KEYS = [
  "ZOOM_MEETING_SDK_CLIENT_ID",
  "ZOOM_MEETING_SDK_CLIENT_SECRET",
  "ZOOM_ACCOUNT_ID",
  "ZOOM_CLIENT_ID",
  "ZOOM_CLIENT_SECRET",
  "ZOOM_HOST_USER_ID",
  "ZOOM_WEBHOOK_SECRET"
];
const NONESSENTIAL_INTEGRATION_KEYS = [
  "SMS_OTP_PROVIDER",
  "SMS_OTP_API_KEY",
  "SMS_OTP_API_SECRET",
  "SMS_OTP_CHALLENGE_ENCRYPTION_KEY",
  "THAI_QR_PROMPTPAY_ID",
  "THAI_QR_PROMPTPAY_ACCOUNT_NAME",
  "PAYMENT_WEBHOOK_SECRET",
  "STORE_RESERVATION_CLEANUP_SECRET",
  "SLIP_VERIFICATION_PROVIDER",
  "SLIP_VERIFICATION_API_URL",
  "SLIP_VERIFICATION_API_KEY",
  "SLIPOK_BRANCH_ID",
  "SLIP_VERIFICATION_EXPECTED_RECEIVER_NAME",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_PUBLIC_BASE_URL",
  "STAFF_UPLOAD_DIR",
  "COMMUNITY_UPLOAD_DIR",
  "PAYMENT_UPLOAD_DIR"
];
const DISABLED_FEATURE_FLAGS = [
  "ENABLE_PATIENT_PORTAL",
  "ENABLE_ONLINE_BOOKING",
  "ENABLE_PAYMENTS",
  "ENABLE_AI_FEATURES",
  "ENABLE_COMMUNITY",
  "ENABLE_PRESCRIPTIONS"
];
const MIGRATION_TARGET_KEYS = [
  "PLESK_MIGRATION_TARGET",
  "PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET",
  "PLESK_SMS_OTP_RECONCILIATION_TARGET"
];
const ALLOWED_ARGUMENTS = new Set([
  "mode",
  "confirm-test",
  "fixture-key",
  "scheduled-at",
  "target-fingerprint",
  "expected-status",
  "expected-zoom"
]);
const REQUIRED_SCHEMA_COLUMNS = Object.freeze({
  User: [
    "id",
    "lineUserId",
    "role",
    "status",
    "fullName",
    "dateOfBirth",
    "phone",
    "normalizedPhone",
    "phoneVerifiedAt"
  ],
  Doctor: ["id", "userId", "status"],
  Consultation: [
    "id",
    "patientId",
    "doctorId",
    "bookedDurationMinutes",
    "status",
    "scheduledAt",
    "zoomMeetingId",
    "zoomPassword",
    "zoomJoinUrl",
    "summary"
  ],
  ConsultationSlotLock: ["id", "doctorId", "scheduledAt"],
  Payment: ["id", "consultationId"],
  FileAttachment: ["id", "entityId", "entityType", "purpose"],
  Prescription: ["id", "consultationId"],
  OrderItem: ["id", "prescriptionId"],
  AuditLog: ["id", "action", "entityType", "entityId", "metadataJson"]
});

const RUNNER_FAILURE_CODES = Object.freeze({
  APP_URL_NOT_TEST: "APP_URL_NOT_TEST",
  CONFIRM_TEST_REQUIRED: "CONFIRM_TEST_REQUIRED",
  CUSTOMER_INELIGIBLE: "CUSTOMER_INELIGIBLE",
  CUSTOMER_NOT_FOUND_OR_AMBIGUOUS: "CUSTOMER_NOT_FOUND_OR_AMBIGUOUS",
  DATABASE_IDENTITY_MISMATCH: "DATABASE_IDENTITY_MISMATCH",
  DATABASE_PROVENANCE_REJECTED: "DATABASE_PROVENANCE_REJECTED",
  DATABASE_CONFIG_NOT_READY: "DATABASE_CONFIG_NOT_READY",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  DEPLOYMENT_MARKER_INVALID: "DEPLOYMENT_MARKER_INVALID",
  DEV_AUTH_BYPASS_NOT_DISABLED: "DEV_AUTH_BYPASS_NOT_DISABLED",
  DOCTOR_INELIGIBLE: "DOCTOR_INELIGIBLE",
  DOCTOR_NOT_FOUND_OR_AMBIGUOUS: "DOCTOR_NOT_FOUND_OR_AMBIGUOUS",
  ENVIRONMENT_NOT_PRODUCTION: "ENVIRONMENT_NOT_PRODUCTION",
  FIXTURE_PROVENANCE_INVALID: "FIXTURE_PROVENANCE_INVALID",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  LINE_CONFIG_NOT_READY: "LINE_CONFIG_NOT_READY",
  MIGRATION_TARGET_PRESENT: "MIGRATION_TARGET_PRESENT",
  NONESSENTIAL_INTEGRATION_ENABLED: "NONESSENTIAL_INTEGRATION_ENABLED",
  RELATED_RECORD_BOUNDARY_FAILED: "RELATED_RECORD_BOUNDARY_FAILED",
  SCHEMA_NOT_READY: "SCHEMA_NOT_READY",
  SLOT_NOT_FUTURE: "SLOT_NOT_FUTURE",
  SLOT_OVERLAP: "SLOT_OVERLAP",
  SLOT_TOO_FAR: "SLOT_TOO_FAR",
  TARGET_FINGERPRINT_MISMATCH: "TARGET_FINGERPRINT_MISMATCH",
  TARGET_SET_TOO_LARGE: "TARGET_SET_TOO_LARGE",
  TEST_AUTH_CONFIG_NOT_READY: "TEST_AUTH_CONFIG_NOT_READY",
  TEST_CREDENTIAL_CONFIRMATION_REQUIRED: "TEST_CREDENTIAL_CONFIRMATION_REQUIRED",
  TRANSACTION_CONFLICT: "TRANSACTION_CONFLICT",
  UNKNOWN_SAFE_FAILURE: "UNKNOWN_SAFE_FAILURE",
  ZOOM_CONFIG_NOT_READY: "ZOOM_CONFIG_NOT_READY"
});
const RUNNER_FAILURE_STAGES = new Set([
  "arguments",
  "database",
  "environment",
  "fixture",
  "integrity",
  "schema",
  "slot",
  "target",
  "transaction",
  "unknown"
]);
const DATABASE_UNAVAILABLE_CODES = new Set(["P1000", "P1001", "P1002", "P1003", "P1008", "P1017"]);
const TRANSACTION_CONFLICT_CODES = new Set(["P2028", "P2034"]);

class RunnerFailure extends Error {
  constructor(code, stage) {
    super(code);
    this.code = code;
    this.stage = stage;
  }
}

function fail(code, stage) {
  throw new RunnerFailure(code, stage);
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hashesMatch(actual, expected) {
  if (!HASH_PATTERN.test(actual) || !HASH_PATTERN.test(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
    }
    if (argument === "--confirm-test") {
      if (values.has("confirm-test")) fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
      values.set("confirm-test", true);
      continue;
    }
    const separator = argument.indexOf("=");
    if (separator <= 2) fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
    const name = argument.slice(2, separator);
    const value = argument.slice(separator + 1);
    if (!ALLOWED_ARGUMENTS.has(name) || name === "confirm-test" || !value || values.has(name)) {
      fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
    }
    values.set(name, value);
  }
  return values;
}

function requiredArgument(values, name) {
  const value = values.get(name);
  if (!value || value === true) fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  return value;
}

function parseIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  }
  return date;
}

function assertStaticEnvironment(environment) {
  if (environment.NODE_ENV !== "production") {
    fail(RUNNER_FAILURE_CODES.ENVIRONMENT_NOT_PRODUCTION, "environment");
  }
  if (environment.CE_DEPLOYMENT_ENVIRONMENT !== TEST_DEPLOYMENT_MARKER) {
    fail(RUNNER_FAILURE_CODES.DEPLOYMENT_MARKER_INVALID, "environment");
  }
  if (environment.NEXT_PUBLIC_APP_URL !== TEST_APP_URL) {
    fail(RUNNER_FAILURE_CODES.APP_URL_NOT_TEST, "environment");
  }
  if (!hasValue(environment.DATABASE_URL)) {
    fail(RUNNER_FAILURE_CODES.DATABASE_CONFIG_NOT_READY, "environment");
  }
  if (environment.ENABLE_DEV_AUTH_BYPASS !== "false") {
    fail(RUNNER_FAILURE_CODES.DEV_AUTH_BYPASS_NOT_DISABLED, "environment");
  }
  if (
    !hasValue(environment.JWT_SECRET) ||
    environment.JWT_SECRET.trim().length < 32 ||
    !hasValue(environment.JWT_ISSUER) ||
    !TEST_IDENTITY_PATTERN.test(environment.JWT_ISSUER)
  ) {
    fail(RUNNER_FAILURE_CODES.TEST_AUTH_CONFIG_NOT_READY, "environment");
  }
  if (
    !hasValue(environment.NEXT_PUBLIC_LINE_LIFF_ID) ||
    !hasValue(environment.LINE_CHANNEL_ID) ||
    !hasValue(environment.LINE_CHANNEL_SECRET) ||
    environment.LINE_LOGIN_CALLBACK_URL !== TEST_LINE_CALLBACK_URL
  ) {
    fail(RUNNER_FAILURE_CODES.LINE_CONFIG_NOT_READY, "environment");
  }
  if (REQUIRED_ZOOM_KEYS.some((key) => !hasValue(environment[key]))) {
    fail(RUNNER_FAILURE_CODES.ZOOM_CONFIG_NOT_READY, "environment");
  }
  if (
    environment.ZOOM_TEST_WEBHOOK_URL !== TEST_ZOOM_WEBHOOK_URL ||
    environment.ENABLE_VIDEO_CONSULTATIONS !== "true"
  ) {
    fail(RUNNER_FAILURE_CODES.ZOOM_CONFIG_NOT_READY, "environment");
  }
  if (
    environment.ZOOM_TEST_LINE_CREDENTIALS_CONFIRMED !== "true" ||
    environment.ZOOM_TEST_ZOOM_CREDENTIALS_CONFIRMED !== "true"
  ) {
    fail(RUNNER_FAILURE_CODES.TEST_CREDENTIAL_CONFIRMATION_REQUIRED, "environment");
  }
  if (MIGRATION_TARGET_KEYS.some((key) => Object.prototype.hasOwnProperty.call(environment, key))) {
    fail(RUNNER_FAILURE_CODES.MIGRATION_TARGET_PRESENT, "environment");
  }
  if (
    NONESSENTIAL_INTEGRATION_KEYS.some((key) => hasValue(environment[key])) ||
    DISABLED_FEATURE_FLAGS.some((key) => hasValue(environment[key]) && environment[key] !== "false")
  ) {
    fail(RUNNER_FAILURE_CODES.NONESSENTIAL_INTEGRATION_ENABLED, "environment");
  }
}

function parseRunnerOptions(argv, environment = process.env, now = new Date()) {
  const values = parseArguments(argv);
  const mode = requiredArgument(values, "mode");
  if (!RUNNER_MODES.has(mode)) fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  if (values.get("confirm-test") !== true) {
    fail(RUNNER_FAILURE_CODES.CONFIRM_TEST_REQUIRED, "environment");
  }
  assertStaticEnvironment(environment);

  const fixtureKey = requiredArgument(values, "fixture-key");
  if (!FIXTURE_KEY_PATTERN.test(fixtureKey)) fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  const scheduledAt = parseIsoDate(requiredArgument(values, "scheduled-at"));
  if (mode === "precheck" || mode === "create") {
    if (scheduledAt.getTime() <= now.getTime()) fail(RUNNER_FAILURE_CODES.SLOT_NOT_FUTURE, "slot");
    if (scheduledAt.getTime() > now.getTime() + MAX_FUTURE_SLOT_DAYS * 24 * 60 * 60 * 1000) {
      fail(RUNNER_FAILURE_CODES.SLOT_TOO_FAR, "slot");
    }
  }

  const targetFingerprint =
    mode === "precheck" ? null : requiredArgument(values, "target-fingerprint").toLowerCase();
  if (targetFingerprint && !HASH_PATTERN.test(targetFingerprint)) {
    fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  }
  const expectedStatus = values.get("expected-status") || "scheduled";
  const expectedZoom = values.get("expected-zoom") || "absent";
  if (!ALLOWED_VERIFY_STATUSES.has(expectedStatus) || !ALLOWED_ZOOM_STATES.has(expectedZoom)) {
    fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  }
  if (mode !== "verify" && (values.has("expected-status") || values.has("expected-zoom"))) {
    fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  }

  const databaseIdentityHash = environment.ZOOM_TEST_DATABASE_IDENTITY_SHA256?.trim().toLowerCase();
  const customerUserIdHash = environment.ZOOM_TEST_CUSTOMER_USER_ID_SHA256?.trim().toLowerCase();
  const doctorUserIdHash = environment.ZOOM_TEST_DOCTOR_USER_ID_SHA256?.trim().toLowerCase();
  if (
    !databaseIdentityHash ||
    !customerUserIdHash ||
    !doctorUserIdHash ||
    !HASH_PATTERN.test(databaseIdentityHash) ||
    !HASH_PATTERN.test(customerUserIdHash) ||
    !HASH_PATTERN.test(doctorUserIdHash)
  ) {
    fail(RUNNER_FAILURE_CODES.DATABASE_IDENTITY_MISMATCH, "environment");
  }
  if (customerUserIdHash === doctorUserIdHash) {
    fail(RUNNER_FAILURE_CODES.INVALID_ARGUMENT, "environment");
  }
  return {
    customerUserIdHash,
    databaseIdentityHash,
    doctorUserIdHash,
    expectedStatus,
    expectedZoom,
    fixtureKey,
    mode,
    scheduledAt,
    targetFingerprint
  };
}

function isTestOnlyDatabaseIdentity(databaseName, databaseUser) {
  const userName = databaseUser.split("@", 1)[0];
  return (
    TEST_IDENTITY_PATTERN.test(databaseName) &&
    TEST_IDENTITY_PATTERN.test(userName) &&
    !PRODUCTION_IDENTITY_PATTERN.test(databaseName) &&
    !PRODUCTION_IDENTITY_PATTERN.test(userName)
  );
}

function getDatabaseIdentityHash(databaseName, databaseUser) {
  return sha256([databaseName, databaseUser].join("\0"));
}

async function assertDatabaseIdentity(prisma, expectedHash) {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT DATABASE() AS databaseName, CURRENT_USER() AS databaseUser"
  );
  if (!Array.isArray(rows) || rows.length !== 1) {
    fail(RUNNER_FAILURE_CODES.DATABASE_PROVENANCE_REJECTED, "database");
  }
  const databaseName = rows[0]?.databaseName;
  const databaseUser = rows[0]?.databaseUser;
  if (
    typeof databaseName !== "string" ||
    typeof databaseUser !== "string" ||
    !isTestOnlyDatabaseIdentity(databaseName, databaseUser)
  ) {
    fail(RUNNER_FAILURE_CODES.DATABASE_PROVENANCE_REJECTED, "database");
  }
  const actualHash = getDatabaseIdentityHash(databaseName, databaseUser);
  if (!hashesMatch(actualHash, expectedHash)) {
    fail(RUNNER_FAILURE_CODES.DATABASE_IDENTITY_MISMATCH, "database");
  }
  return actualHash;
}

function getSourceMigrationNames(rootDir = path.resolve(__dirname, "..")) {
  const migrationsDir = path.join(rootDir, "prisma", "migrations");
  const names = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_[A-Za-z0-9_]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0) fail(RUNNER_FAILURE_CODES.SCHEMA_NOT_READY, "schema");
  return names;
}

function assertMigrationRows(rows, sourceMigrationNames) {
  if (!Array.isArray(rows) || rows.length !== sourceMigrationNames.length) {
    fail(RUNNER_FAILURE_CODES.SCHEMA_NOT_READY, "schema");
  }
  const applied = [];
  for (const row of rows) {
    if (typeof row?.migrationName !== "string" || !row.finishedAt || row.rolledBackAt) {
      fail(RUNNER_FAILURE_CODES.SCHEMA_NOT_READY, "schema");
    }
    applied.push(row.migrationName);
  }
  applied.sort();
  if (applied.some((name, index) => name !== sourceMigrationNames[index])) {
    fail(RUNNER_FAILURE_CODES.SCHEMA_NOT_READY, "schema");
  }
}

function assertSchemaColumns(rows) {
  if (!Array.isArray(rows)) fail(RUNNER_FAILURE_CODES.SCHEMA_NOT_READY, "schema");
  const columns = new Set(
    rows
      .filter((row) => typeof row?.tableName === "string" && typeof row?.columnName === "string")
      .map((row) => row.tableName + "." + row.columnName)
  );
  for (const [tableName, columnNames] of Object.entries(REQUIRED_SCHEMA_COLUMNS)) {
    for (const columnName of columnNames) {
      if (!columns.has(tableName + "." + columnName)) {
        fail(RUNNER_FAILURE_CODES.SCHEMA_NOT_READY, "schema");
      }
    }
  }
}

async function assertSchemaReadiness(prisma, sourceMigrationNames = getSourceMigrationNames()) {
  const [migrationRows, columnRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      "SELECT migration_name AS migrationName, finished_at AS finishedAt, rolled_back_at AS rolledBackAt FROM _prisma_migrations"
    ),
    prisma.$queryRawUnsafe(
      "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
    )
  ]);
  assertMigrationRows(migrationRows, sourceMigrationNames);
  assertSchemaColumns(columnRows);
  return true;
}

function getFixtureSummary(fixtureKey) {
  return FIXTURE_PREFIX + "; key=" + fixtureKey;
}

function getTargetFingerprint(target, options, databaseIdentityHash) {
  return sha256(
    [
      "zoom-test-fixture:v1",
      databaseIdentityHash,
      target.customer.id,
      target.doctor.id,
      target.doctor.userId,
      options.fixtureKey,
      options.scheduledAt.toISOString()
    ].join("\0")
  );
}

function matchTargetHash(id, expectedHash) {
  return hashesMatch(sha256(id), expectedHash);
}

function isVerifiedCustomer(customer) {
  return Boolean(
    customer &&
      customer.role === "customer" &&
      customer.status === "active" &&
      hasValue(customer.lineUserId) &&
      hasValue(customer.fullName) &&
      customer.dateOfBirth &&
      hasValue(customer.phone) &&
      hasValue(customer.normalizedPhone) &&
      customer.phoneVerifiedAt
  );
}

function isApprovedDoctor(doctor) {
  return Boolean(
    doctor &&
      doctor.status === "approved" &&
      hasValue(doctor.userId) &&
      doctor.user?.id === doctor.userId &&
      doctor.user.role === "doctor" &&
      doctor.user.status === "active" &&
      hasValue(doctor.user.lineUserId)
  );
}

async function resolveTarget(prisma, options) {
  const [customers, doctors] = await Promise.all([
    prisma.user.findMany({
      where: { lineUserId: { not: "" } },
      select: {
        id: true,
        lineUserId: true,
        role: true,
        status: true,
        fullName: true,
        dateOfBirth: true,
        phone: true,
        normalizedPhone: true,
        phoneVerifiedAt: true
      },
      take: MAX_TARGET_CANDIDATES + 1
    }),
    prisma.doctor.findMany({
      where: { user: { lineUserId: { not: "" } } },
      select: {
        id: true,
        status: true,
        userId: true,
        user: { select: { id: true, lineUserId: true, role: true, status: true } }
      },
      take: MAX_TARGET_CANDIDATES + 1
    })
  ]);
  if (customers.length > MAX_TARGET_CANDIDATES || doctors.length > MAX_TARGET_CANDIDATES) {
    fail(RUNNER_FAILURE_CODES.TARGET_SET_TOO_LARGE, "target");
  }
  const customerMatches = customers.filter((customer) =>
    matchTargetHash(customer.id, options.customerUserIdHash)
  );
  const doctorMatches = doctors.filter((doctor) =>
    matchTargetHash(doctor.userId, options.doctorUserIdHash)
  );
  if (customerMatches.length !== 1) {
    fail(RUNNER_FAILURE_CODES.CUSTOMER_NOT_FOUND_OR_AMBIGUOUS, "target");
  }
  if (!isVerifiedCustomer(customerMatches[0])) {
    fail(RUNNER_FAILURE_CODES.CUSTOMER_INELIGIBLE, "target");
  }
  if (doctorMatches.length !== 1) {
    fail(RUNNER_FAILURE_CODES.DOCTOR_NOT_FOUND_OR_AMBIGUOUS, "target");
  }
  if (!isApprovedDoctor(doctorMatches[0])) {
    fail(RUNNER_FAILURE_CODES.DOCTOR_INELIGIBLE, "target");
  }
  return { customer: customerMatches[0], doctor: doctorMatches[0] };
}

function getOverlap(consultations, scheduledAt) {
  const fixtureEnd = new Date(scheduledAt.getTime() + FIXTURE_DURATION_MINUTES * 60_000);
  for (const consultation of consultations) {
    if (!consultation.scheduledAt) continue;
    const duration = consultation.bookedDurationMinutes ?? FIXTURE_DURATION_MINUTES;
    if (!Number.isInteger(duration) || duration <= 0 || duration > MAX_SUPPORTED_BOOKED_DURATION_MINUTES) {
      fail(RUNNER_FAILURE_CODES.SLOT_OVERLAP, "slot");
    }
    const consultationEnd = new Date(consultation.scheduledAt.getTime() + duration * 60_000);
    if (consultation.scheduledAt < fixtureEnd && consultationEnd > scheduledAt) return consultation;
  }
  return null;
}

async function assertNoSlotOverlap(prisma, target, scheduledAt) {
  const lookback = new Date(scheduledAt.getTime() - MAX_SUPPORTED_BOOKED_DURATION_MINUTES * 60_000);
  const fixtureEnd = new Date(scheduledAt.getTime() + FIXTURE_DURATION_MINUTES * 60_000);
  const [consultations, slotLock] = await Promise.all([
    prisma.consultation.findMany({
      where: {
        doctorId: target.doctor.id,
        scheduledAt: { gte: lookback, lt: fixtureEnd },
        status: { in: ACTIVE_CONSULTATION_STATUSES }
      },
      select: { bookedDurationMinutes: true, scheduledAt: true }
    }),
    prisma.consultationSlotLock.findFirst({
      where: { doctorId: target.doctor.id, scheduledAt },
      select: { id: true }
    })
  ]);
  if (slotLock || getOverlap(consultations, scheduledAt)) {
    fail(RUNNER_FAILURE_CODES.SLOT_OVERLAP, "slot");
  }
}

const FIXTURE_SELECT = {
  bookedDurationMinutes: true,
  doctorId: true,
  id: true,
  patientId: true,
  scheduledAt: true,
  status: true,
  summary: true,
  zoomMeetingId: true,
  zoomPassword: true,
  zoomJoinUrl: true
};

async function findFixture(prisma, fixtureKey) {
  const fixtures = await prisma.consultation.findMany({
    where: { summary: getFixtureSummary(fixtureKey) },
    select: FIXTURE_SELECT,
    take: 2
  });
  if (fixtures.length > 1) fail(RUNNER_FAILURE_CODES.FIXTURE_PROVENANCE_INVALID, "fixture");
  return fixtures[0] || null;
}

async function getFixtureIntegrity(prisma, fixture) {
  const [paymentCount, slipAttachmentCount, prescriptionCount, orderCount, audits] = await Promise.all([
    prisma.payment.count({ where: { consultationId: fixture.id } }),
    prisma.fileAttachment.count({
      where: { entityId: fixture.id, entityType: "consultation", purpose: "payment_slip" }
    }),
    prisma.prescription.count({ where: { consultationId: fixture.id } }),
    prisma.orderItem.count({ where: { prescription: { is: { consultationId: fixture.id } } } }),
    prisma.auditLog.findMany({
      where: {
        action: { in: [FIXTURE_ACTION_CREATED, FIXTURE_ACTION_CANCELLED] },
        entityId: fixture.id,
        entityType: "consultation"
      },
      select: { action: true, metadataJson: true }
    })
  ]);
  return { audits, orderCount, paymentCount, prescriptionCount, slipAttachmentCount };
}

function hasExpectedAudit(audit, action, targetFingerprint) {
  const metadata = audit?.metadataJson;
  return Boolean(
    audit?.action === action &&
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      metadata.controlled === true &&
      metadata.testOnly === true &&
      metadata.fixtureRunnerVersion === 1 &&
      metadata.targetFingerprint === targetFingerprint
  );
}

function assertFixtureBoundary(
  fixture,
  integrity,
  target,
  options,
  targetFingerprint,
  expectedStatus,
  expectedZoom
) {
  if (
    fixture.patientId !== target.customer.id ||
    fixture.doctorId !== target.doctor.id ||
    fixture.summary !== getFixtureSummary(options.fixtureKey) ||
    !fixture.scheduledAt ||
    fixture.scheduledAt.toISOString() !== options.scheduledAt.toISOString() ||
    fixture.bookedDurationMinutes !== FIXTURE_DURATION_MINUTES
  ) {
    fail(RUNNER_FAILURE_CODES.FIXTURE_PROVENANCE_INVALID, "fixture");
  }
  if (
    fixture.status !== expectedStatus ||
    integrity.paymentCount !== 0 ||
    integrity.slipAttachmentCount !== 0 ||
    integrity.prescriptionCount !== 0 ||
    integrity.orderCount !== 0
  ) {
    fail(RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "integrity");
  }
  const zoomPresent = Boolean(fixture.zoomMeetingId);
  if (
    (expectedZoom === "present" && !zoomPresent) ||
    (expectedZoom === "absent" && (zoomPresent || fixture.zoomPassword || fixture.zoomJoinUrl))
  ) {
    fail(RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "integrity");
  }
  const createdAudits = integrity.audits.filter((audit) => audit.action === FIXTURE_ACTION_CREATED);
  const cancelledAudits = integrity.audits.filter((audit) => audit.action === FIXTURE_ACTION_CANCELLED);
  if (
    createdAudits.length !== 1 ||
    !hasExpectedAudit(createdAudits[0], FIXTURE_ACTION_CREATED, targetFingerprint) ||
    cancelledAudits.length > 1 ||
    (expectedStatus === "cancelled" &&
      (cancelledAudits.length !== 1 ||
        !hasExpectedAudit(cancelledAudits[0], FIXTURE_ACTION_CANCELLED, targetFingerprint))) ||
    (expectedStatus !== "cancelled" && cancelledAudits.length !== 0)
  ) {
    fail(RUNNER_FAILURE_CODES.FIXTURE_PROVENANCE_INVALID, "integrity");
  }
}

function assertTargetFingerprint(target, options, databaseIdentityHash) {
  const expected = getTargetFingerprint(target, options, databaseIdentityHash);
  if (!options.targetFingerprint || !hashesMatch(expected, options.targetFingerprint)) {
    fail(RUNNER_FAILURE_CODES.TARGET_FINGERPRINT_MISMATCH, "fixture");
  }
  return expected;
}

function safeResult(mode, fingerprint, fixture, integrity, replayed) {
  return {
    status: "ok",
    mode,
    stage: "complete",
    databaseIdentity: "matched",
    schema: "ready",
    fingerprint,
    fixtureStatus: fixture?.status || "absent",
    zoom: fixture?.zoomMeetingId ? "present" : "absent",
    replayed,
    counts: integrity
      ? {
          audit: integrity.audits.length,
          consultation: 1,
          order: integrity.orderCount,
          payment: integrity.paymentCount,
          prescription: integrity.prescriptionCount,
          slipAttachment: integrity.slipAttachmentCount
        }
      : { audit: 0, consultation: 0, order: 0, payment: 0, prescription: 0, slipAttachment: 0 }
  };
}

async function validateExistingFixture(prisma, fixture, target, options, fingerprint) {
  const integrity = await getFixtureIntegrity(prisma, fixture);
  const zoomState = fixture.zoomMeetingId ? "present" : "absent";
  if (!ALLOWED_VERIFY_STATUSES.has(fixture.status)) {
    fail(RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "fixture");
  }
  assertFixtureBoundary(fixture, integrity, target, options, fingerprint, fixture.status, zoomState);
  return integrity;
}

async function runTestFixtureRunner(prisma, options, databaseIdentityHash) {
  const target = await resolveTarget(prisma, options);
  const fingerprint = getTargetFingerprint(target, options, databaseIdentityHash);
  if (options.mode === "precheck") {
    const existing = await findFixture(prisma, options.fixtureKey);
    if (existing) {
      const integrity = await validateExistingFixture(prisma, existing, target, options, fingerprint);
      return safeResult("precheck", fingerprint, existing, integrity, true);
    }
    await assertNoSlotOverlap(prisma, target, options.scheduledAt);
    return safeResult("precheck", fingerprint, null, null, false);
  }
  assertTargetFingerprint(target, options, databaseIdentityHash);

  if (options.mode === "create") {
    return prisma.$transaction(
      async (transaction) => {
        const lockedTarget = await resolveTarget(transaction, options);
        const lockedFingerprint = assertTargetFingerprint(lockedTarget, options, databaseIdentityHash);
        const existing = await findFixture(transaction, options.fixtureKey);
        if (existing) {
          const integrity = await validateExistingFixture(
            transaction,
            existing,
            lockedTarget,
            options,
            lockedFingerprint
          );
          if (existing.status !== "scheduled" || existing.zoomMeetingId) {
            fail(RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "fixture");
          }
          return safeResult("create", lockedFingerprint, existing, integrity, true);
        }
        await assertNoSlotOverlap(transaction, lockedTarget, options.scheduledAt);
        const fixture = await transaction.consultation.create({
          data: {
            bookedDurationMinutes: FIXTURE_DURATION_MINUTES,
            doctorId: lockedTarget.doctor.id,
            patientId: lockedTarget.customer.id,
            scheduledAt: options.scheduledAt,
            status: "scheduled",
            summary: getFixtureSummary(options.fixtureKey)
          },
          select: FIXTURE_SELECT
        });
        const beforeAudit = await getFixtureIntegrity(transaction, fixture);
        if (beforeAudit.audits.length !== 0) {
          fail(RUNNER_FAILURE_CODES.FIXTURE_PROVENANCE_INVALID, "integrity");
        }
        if (
          beforeAudit.paymentCount !== 0 ||
          beforeAudit.slipAttachmentCount !== 0 ||
          beforeAudit.prescriptionCount !== 0 ||
          beforeAudit.orderCount !== 0 ||
          fixture.zoomMeetingId ||
          fixture.zoomPassword ||
          fixture.zoomJoinUrl
        ) {
          fail(RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "integrity");
        }
        await transaction.auditLog.create({
          data: {
            action: FIXTURE_ACTION_CREATED,
            entityId: fixture.id,
            entityType: "consultation",
            metadataJson: {
              controlled: true,
              fixtureRunnerVersion: 1,
              nonMonetary: true,
              testOnly: true,
              targetFingerprint: lockedFingerprint
            }
          }
        });
        const integrity = await getFixtureIntegrity(transaction, fixture);
        assertFixtureBoundary(
          fixture,
          integrity,
          lockedTarget,
          options,
          lockedFingerprint,
          "scheduled",
          "absent"
        );
        return safeResult("create", lockedFingerprint, fixture, integrity, false);
      },
      { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 }
    );
  }

  const fixture = await findFixture(prisma, options.fixtureKey);
  if (!fixture) fail(RUNNER_FAILURE_CODES.FIXTURE_PROVENANCE_INVALID, "fixture");
  if (options.mode === "verify") {
    const integrity = await getFixtureIntegrity(prisma, fixture);
    assertFixtureBoundary(
      fixture,
      integrity,
      target,
      options,
      fingerprint,
      options.expectedStatus,
      options.expectedZoom
    );
    return safeResult("verify", fingerprint, fixture, integrity, false);
  }

  return prisma.$transaction(
    async (transaction) => {
      const lockedTarget = await resolveTarget(transaction, options);
      const lockedFingerprint = assertTargetFingerprint(lockedTarget, options, databaseIdentityHash);
      const current = await findFixture(transaction, options.fixtureKey);
      if (!current) fail(RUNNER_FAILURE_CODES.FIXTURE_PROVENANCE_INVALID, "fixture");
      const before = await getFixtureIntegrity(transaction, current);
      const zoomState = current.zoomMeetingId ? "present" : "absent";
      if (current.status === "cancelled") {
        assertFixtureBoundary(
          current,
          before,
          lockedTarget,
          options,
          lockedFingerprint,
          "cancelled",
          zoomState
        );
        return safeResult("cleanup", lockedFingerprint, current, before, true);
      }
      if (current.status !== "scheduled" && current.status !== "live") {
        fail(RUNNER_FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "fixture");
      }
      assertFixtureBoundary(
        current,
        before,
        lockedTarget,
        options,
        lockedFingerprint,
        current.status,
        zoomState
      );
      const updated = await transaction.consultation.updateMany({
        where: {
          doctorId: lockedTarget.doctor.id,
          id: current.id,
          patientId: lockedTarget.customer.id,
          scheduledAt: options.scheduledAt,
          status: current.status,
          summary: getFixtureSummary(options.fixtureKey)
        },
        data: { status: "cancelled" }
      });
      if (updated.count !== 1) fail(RUNNER_FAILURE_CODES.TRANSACTION_CONFLICT, "transaction");
      await transaction.auditLog.create({
        data: {
          action: FIXTURE_ACTION_CANCELLED,
          entityId: current.id,
          entityType: "consultation",
          metadataJson: {
            controlled: true,
            fixtureRunnerVersion: 1,
            testOnly: true,
            targetFingerprint: lockedFingerprint
          }
        }
      });
      const cancelled = await findFixture(transaction, options.fixtureKey);
      const after = await getFixtureIntegrity(transaction, cancelled);
      assertFixtureBoundary(
        cancelled,
        after,
        lockedTarget,
        options,
        lockedFingerprint,
        "cancelled",
        zoomState
      );
      return safeResult("cleanup", lockedFingerprint, cancelled, after, false);
    },
    { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 }
  );
}

function getSafeMode(argv) {
  const value = argv.find((argument) => argument.startsWith("--mode="))?.slice("--mode=".length);
  return RUNNER_MODES.has(value) ? value : "unknown";
}

function getSafeFailure(error) {
  if (error instanceof RunnerFailure && Object.values(RUNNER_FAILURE_CODES).includes(error.code)) {
    return { code: error.code, stage: RUNNER_FAILURE_STAGES.has(error.stage) ? error.stage : "unknown" };
  }
  const prismaCode = typeof error?.code === "string" ? error.code : null;
  if (DATABASE_UNAVAILABLE_CODES.has(prismaCode)) {
    return { code: RUNNER_FAILURE_CODES.DATABASE_UNAVAILABLE, stage: "database" };
  }
  if (TRANSACTION_CONFLICT_CODES.has(prismaCode)) {
    return { code: RUNNER_FAILURE_CODES.TRANSACTION_CONFLICT, stage: "transaction" };
  }
  return { code: RUNNER_FAILURE_CODES.UNKNOWN_SAFE_FAILURE, stage: "unknown" };
}

function writeSafeFailure(error, argv, write = console.error) {
  const failure = getSafeFailure(error);
  write(JSON.stringify({
    status: "error",
    code: failure.code,
    mode: getSafeMode(argv),
    stage: failure.stage
  }));
}

async function main() {
  const options = parseRunnerOptions(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const databaseIdentityHash = await assertDatabaseIdentity(prisma, options.databaseIdentityHash);
    await assertSchemaReadiness(prisma);
    const result = await runTestFixtureRunner(prisma, options, databaseIdentityHash);
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    writeSafeFailure(error, process.argv.slice(2));
    process.exitCode = 1;
  });
}

module.exports = {
  ACTIVE_CONSULTATION_STATUSES,
  FIXTURE_ACTION_CANCELLED,
  FIXTURE_ACTION_CREATED,
  FIXTURE_DURATION_MINUTES,
  REQUIRED_SCHEMA_COLUMNS,
  RUNNER_FAILURE_CODES,
  RUNNER_FAILURE_STAGES,
  RunnerFailure,
  TEST_APP_URL,
  TEST_LINE_CALLBACK_URL,
  TEST_ZOOM_WEBHOOK_URL,
  assertDatabaseIdentity,
  assertMigrationRows,
  assertSchemaColumns,
  assertSchemaReadiness,
  getDatabaseIdentityHash,
  getFixtureSummary,
  getOverlap,
  getSafeFailure,
  getSafeMode,
  getSourceMigrationNames,
  getTargetFingerprint,
  hashesMatch,
  isTestOnlyDatabaseIdentity,
  parseRunnerOptions,
  resolveTarget,
  runTestFixtureRunner,
  sha256,
  writeSafeFailure
};
