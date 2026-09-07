/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const {
  RunnerFailure,
  TEST_APP_URL,
  TEST_LINE_CALLBACK_URL,
  assertDatabaseIdentity,
  assertSchemaReadiness,
  hashesMatch,
  sha256
} = require("./zoom-test-fixture-runner.cjs");

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const VERSION = "zoom-test-account-bootstrap:v1";
const AUDIT_ACTION = "user.zoom_test_account_bootstrapped";
const AUDIT_ENTITY_TYPE = "User";
const CUSTOMER_FULL_NAME = "[TEST ONLY] Zoom Customer";
const DOCTOR_FULL_NAME = "[TEST ONLY] Zoom Doctor";
const CUSTOMER_DATE_OF_BIRTH = new Date("2000-01-01T00:00:00.000Z");
const CUSTOMER_PHONE = "TEST-ONLY-NO-SMS";
const DOCTOR_SPECIALTY = "Test-only Zoom UAT";
const DOCTOR_BIO = "[TEST ONLY] Synthetic Zoom UAT account. Do not use for care.";
const MODES = new Set(["precheck", "apply", "verify"]);
const MIGRATION_TARGET_KEYS = [
  "PLESK_MIGRATION_TARGET",
  "PLESK_SMS_OTP_SCHEMA_RECONCILIATION_TARGET",
  "PLESK_SMS_OTP_RECONCILIATION_TARGET"
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
const FAILURE_CODES = Object.freeze({
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  CONFIRM_TEST_REQUIRED: "CONFIRM_TEST_REQUIRED",
  ENVIRONMENT_NOT_PRODUCTION: "ENVIRONMENT_NOT_PRODUCTION",
  DEPLOYMENT_MARKER_INVALID: "DEPLOYMENT_MARKER_INVALID",
  APP_URL_NOT_TEST: "APP_URL_NOT_TEST",
  DATABASE_CONFIG_NOT_READY: "DATABASE_CONFIG_NOT_READY",
  DATABASE_IDENTITY_MISMATCH: "DATABASE_IDENTITY_MISMATCH",
  DATABASE_PROVENANCE_REJECTED: "DATABASE_PROVENANCE_REJECTED",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  DEV_AUTH_BYPASS_NOT_DISABLED: "DEV_AUTH_BYPASS_NOT_DISABLED",
  TEST_AUTH_CONFIG_NOT_READY: "TEST_AUTH_CONFIG_NOT_READY",
  LINE_CONFIG_NOT_READY: "LINE_CONFIG_NOT_READY",
  TEST_CREDENTIAL_CONFIRMATION_REQUIRED: "TEST_CREDENTIAL_CONFIRMATION_REQUIRED",
  MIGRATION_TARGET_PRESENT: "MIGRATION_TARGET_PRESENT",
  NONESSENTIAL_INTEGRATION_ENABLED: "NONESSENTIAL_INTEGRATION_ENABLED",
  SCHEMA_NOT_READY: "SCHEMA_NOT_READY",
  TARGET_NOT_FOUND_OR_AMBIGUOUS: "TARGET_NOT_FOUND_OR_AMBIGUOUS",
  TARGET_STATE_INVALID: "TARGET_STATE_INVALID",
  TARGET_FINGERPRINT_MISMATCH: "TARGET_FINGERPRINT_MISMATCH",
  RELATED_RECORD_BOUNDARY_FAILED: "RELATED_RECORD_BOUNDARY_FAILED",
  AUDIT_PROVENANCE_INVALID: "AUDIT_PROVENANCE_INVALID",
  TRANSACTION_CONFLICT: "TRANSACTION_CONFLICT",
  UNKNOWN_SAFE_FAILURE: "UNKNOWN_SAFE_FAILURE"
});
const SAFE_STAGES = new Set([
  "arguments",
  "database",
  "environment",
  "integrity",
  "schema",
  "target",
  "transaction",
  "unknown"
]);

function fail(code, stage) {
  throw new RunnerFailure(code, stage);
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseArguments(argv) {
  const values = new Map();
  for (const argument of argv) {
    if (!argument.startsWith("--")) fail(FAILURE_CODES.INVALID_ARGUMENT, "arguments");
    const raw = argument.slice(2);
    if (raw === "confirm-test") {
      if (values.has(raw)) fail(FAILURE_CODES.INVALID_ARGUMENT, "arguments");
      values.set(raw, true);
      continue;
    }
    const separator = raw.indexOf("=");
    if (separator < 1) fail(FAILURE_CODES.INVALID_ARGUMENT, "arguments");
    const key = raw.slice(0, separator);
    const value = raw.slice(separator + 1);
    if (!["mode", "target-fingerprint"].includes(key) || !value || values.has(key)) {
      fail(FAILURE_CODES.INVALID_ARGUMENT, "arguments");
    }
    values.set(key, value);
  }
  if (!values.has("confirm-test")) fail(FAILURE_CODES.CONFIRM_TEST_REQUIRED, "environment");
  const mode = values.get("mode");
  if (!MODES.has(mode)) fail(FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  const targetFingerprint = values.get("target-fingerprint") || null;
  if (mode === "precheck" && targetFingerprint) {
    fail(FAILURE_CODES.INVALID_ARGUMENT, "arguments");
  }
  if (mode !== "precheck" && (!targetFingerprint || !HASH_PATTERN.test(targetFingerprint))) {
    fail(FAILURE_CODES.TARGET_FINGERPRINT_MISMATCH, "target");
  }
  return { mode, targetFingerprint };
}

function parseBootstrapOptions(argv, environment = process.env) {
  const args = parseArguments(argv);
  if (environment.NODE_ENV !== "production") {
    fail(FAILURE_CODES.ENVIRONMENT_NOT_PRODUCTION, "environment");
  }
  if (environment.CE_DEPLOYMENT_ENVIRONMENT !== "test") {
    fail(FAILURE_CODES.DEPLOYMENT_MARKER_INVALID, "environment");
  }
  if (environment.NEXT_PUBLIC_APP_URL !== TEST_APP_URL) {
    fail(FAILURE_CODES.APP_URL_NOT_TEST, "environment");
  }
  if (!hasValue(environment.DATABASE_URL)) {
    fail(FAILURE_CODES.DATABASE_CONFIG_NOT_READY, "environment");
  }
  if (environment.ENABLE_DEV_AUTH_BYPASS !== "false") {
    fail(FAILURE_CODES.DEV_AUTH_BYPASS_NOT_DISABLED, "environment");
  }
  if (
    !hasValue(environment.JWT_SECRET) ||
    environment.JWT_SECRET.length < 32 ||
    environment.JWT_ISSUER !== "clinical-ethereality-test"
  ) {
    fail(FAILURE_CODES.TEST_AUTH_CONFIG_NOT_READY, "environment");
  }
  if (
    !hasValue(environment.NEXT_PUBLIC_LINE_LIFF_ID) ||
    !hasValue(environment.LINE_CHANNEL_ID) ||
    !hasValue(environment.LINE_CHANNEL_SECRET) ||
    environment.LINE_LOGIN_CALLBACK_URL !== TEST_LINE_CALLBACK_URL
  ) {
    fail(FAILURE_CODES.LINE_CONFIG_NOT_READY, "environment");
  }
  if (environment.ZOOM_TEST_LINE_CREDENTIALS_CONFIRMED !== "true") {
    fail(FAILURE_CODES.TEST_CREDENTIAL_CONFIRMATION_REQUIRED, "environment");
  }
  if (MIGRATION_TARGET_KEYS.some((key) => Object.prototype.hasOwnProperty.call(environment, key))) {
    fail(FAILURE_CODES.MIGRATION_TARGET_PRESENT, "environment");
  }
  if (
    NONESSENTIAL_INTEGRATION_KEYS.some((key) => hasValue(environment[key])) ||
    DISABLED_FEATURE_FLAGS.some((key) => environment[key] !== "false")
  ) {
    fail(FAILURE_CODES.NONESSENTIAL_INTEGRATION_ENABLED, "environment");
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
    fail(FAILURE_CODES.DATABASE_IDENTITY_MISMATCH, "environment");
  }
  if (customerUserIdHash === doctorUserIdHash) {
    fail(FAILURE_CODES.INVALID_ARGUMENT, "environment");
  }
  return { ...args, databaseIdentityHash, customerUserIdHash, doctorUserIdHash };
}

function getNormalizedPhone(userId) {
  return "test-zoom-" + sha256(userId).slice(0, 10);
}

function getTargetFingerprint(databaseIdentityHash, customerId, doctorUserId) {
  return sha256([VERSION, databaseIdentityHash, customerId, doctorUserId].join("\0"));
}

function exactMetadata(metadata, accountType, fingerprint) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const expected = {
    accountType,
    controlled: true,
    fingerprint,
    runner: VERSION,
    testOnly: true
  };
  const keys = Object.keys(metadata).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    keys.length === expectedKeys.length &&
    keys.every((key, index) => key === expectedKeys[index]) &&
    expectedKeys.every((key) => metadata[key] === expected[key])
  );
}

function isEmptyCandidate(user) {
  return (
    user.role === "customer" &&
    user.status === "active" &&
    typeof user.lineUserId === "string" &&
    user.lineUserId.length > 0 &&
    user.fullName === null &&
    user.dateOfBirth === null &&
    user.email === null &&
    user.phone === null &&
    user.normalizedPhone === null &&
    user.phoneVerifiedAt === null &&
    user.phoneOtpDispatchClaimedUntil === null &&
    user.rewardBalance === 0 &&
    user.doctorProfile === null &&
    user.pharmacistProfile === null
  );
}

function findAudit(audits, entityId, accountType, fingerprint) {
  const matches = audits.filter((audit) => audit.entityId === entityId);
  if (matches.length !== 1) return null;
  const audit = matches[0];
  if (
    audit.actorId !== null ||
    audit.action !== AUDIT_ACTION ||
    audit.entityType !== AUDIT_ENTITY_TYPE ||
    !exactMetadata(audit.metadataJson, accountType, fingerprint) ||
    !(audit.createdAt instanceof Date)
  ) {
    return null;
  }
  return audit;
}

function sameDate(left, right) {
  return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
}

function isCustomerReplay(user, audit, fingerprint) {
  return (
    user.role === "customer" &&
    user.status === "active" &&
    user.fullName === CUSTOMER_FULL_NAME &&
    sameDate(user.dateOfBirth, CUSTOMER_DATE_OF_BIRTH) &&
    user.email === null &&
    user.phone === CUSTOMER_PHONE &&
    user.normalizedPhone === getNormalizedPhone(user.id) &&
    sameDate(user.phoneVerifiedAt, audit?.createdAt) &&
    user.phoneOtpDispatchClaimedUntil === null &&
    user.rewardBalance === 0 &&
    user.doctorProfile === null &&
    user.pharmacistProfile === null &&
    exactMetadata(audit?.metadataJson, "customer", fingerprint)
  );
}

function isDoctorReplay(user, audit, fingerprint) {
  const profile = user.doctorProfile;
  return (
    user.role === "doctor" &&
    user.status === "active" &&
    user.fullName === DOCTOR_FULL_NAME &&
    user.dateOfBirth === null &&
    user.email === null &&
    user.phone === null &&
    user.normalizedPhone === null &&
    user.phoneVerifiedAt === null &&
    user.phoneOtpDispatchClaimedUntil === null &&
    user.rewardBalance === 0 &&
    user.pharmacistProfile === null &&
    profile !== null &&
    profile.userId === user.id &&
    profile.licenseNumber === null &&
    profile.specialty === DOCTOR_SPECIALTY &&
    profile.bio === DOCTOR_BIO &&
    profile.consultationFee === 0 &&
    profile.status === "approved" &&
    sameDate(profile.approvedAt, audit?.createdAt) &&
    exactMetadata(audit?.metadataJson, "doctor", fingerprint)
  );
}

async function resolveCandidates(prisma, options, databaseIdentityHash) {
  const users = await prisma.user.findMany({
    where: { status: "active", lineUserId: { not: "" } },
    select: {
      id: true,
      lineUserId: true,
      fullName: true,
      dateOfBirth: true,
      email: true,
      phone: true,
      normalizedPhone: true,
      phoneVerifiedAt: true,
      phoneOtpDispatchClaimedUntil: true,
      rewardBalance: true,
      role: true,
      status: true,
      doctorProfile: true,
      pharmacistProfile: true
    }
  });
  const customerMatches = users.filter((user) => hashesMatch(sha256(user.id), options.customerUserIdHash));
  const doctorMatches = users.filter((user) => hashesMatch(sha256(user.id), options.doctorUserIdHash));
  if (
    customerMatches.length !== 1 ||
    doctorMatches.length !== 1 ||
    customerMatches[0].id === doctorMatches[0].id
  ) {
    fail(FAILURE_CODES.TARGET_NOT_FOUND_OR_AMBIGUOUS, "target");
  }
  const customer = customerMatches[0];
  const doctor = doctorMatches[0];
  const fingerprint = getTargetFingerprint(databaseIdentityHash, customer.id, doctor.id);
  const audits = await prisma.auditLog.findMany({
    where: {
      action: AUDIT_ACTION,
      entityType: AUDIT_ENTITY_TYPE,
      entityId: { in: [customer.id, doctor.id] }
    },
    select: {
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      metadataJson: true,
      createdAt: true
    }
  });
  const customerAudit = findAudit(audits, customer.id, "customer", fingerprint);
  const doctorAudit = findAudit(audits, doctor.id, "doctor", fingerprint);
  const initial = isEmptyCandidate(customer) && isEmptyCandidate(doctor) && audits.length === 0;
  const replay =
    audits.length === 2 &&
    isCustomerReplay(customer, customerAudit, fingerprint) &&
    isDoctorReplay(doctor, doctorAudit, fingerprint);
  if (!initial && !replay) fail(FAILURE_CODES.TARGET_STATE_INVALID, "target");
  return { customer, doctor, fingerprint, initial, replay };
}

async function assertNoBusinessRecords(prisma, customerId, doctorUserId) {
  const userIds = [customerId, doctorUserId];
  const [consultations, payments, orders, prescriptions, notifications] = await Promise.all([
    prisma.consultation.count({
      where: { OR: [{ patientId: { in: userIds } }, { doctor: { userId: { in: userIds } } }] }
    }),
    prisma.payment.count({
      where: {
        OR: [
          { order: { userId: { in: userIds } } },
          {
            consultation: {
              OR: [{ patientId: { in: userIds } }, { doctor: { userId: { in: userIds } } }]
            }
          }
        ]
      }
    }),
    prisma.order.count({ where: { userId: { in: userIds } } }),
    prisma.prescription.count({
      where: { OR: [{ patientId: { in: userIds } }, { doctor: { userId: { in: userIds } } }] }
    }),
    prisma.notification.count({ where: { userId: { in: userIds } } })
  ]);
  const counts = { consultations, payments, orders, prescriptions, notifications };
  if (Object.values(counts).some((count) => count !== 0)) {
    fail(FAILURE_CODES.RELATED_RECORD_BOUNDARY_FAILED, "integrity");
  }
  return counts;
}

function safeResult(mode, fingerprint, replayed) {
  return {
    status: "ok",
    mode,
    stage: "complete",
    databaseIdentity: "matched",
    schema: "ready",
    accountState: "bootstrapped",
    fingerprint,
    replayed,
    counts: { accounts: 2, audits: 2 }
  };
}

async function runBootstrap(prisma, options, databaseIdentityHash, now = new Date()) {
  if (options.mode === "apply") {
    return prisma.$transaction(
      async (tx) => {
        const target = await resolveCandidates(tx, options, databaseIdentityHash);
        if (!hashesMatch(target.fingerprint, options.targetFingerprint)) {
          fail(FAILURE_CODES.TARGET_FINGERPRINT_MISMATCH, "target");
        }
        await assertNoBusinessRecords(tx, target.customer.id, target.doctor.id);
        if (target.replay) return safeResult("apply", target.fingerprint, true);

        const customerUpdate = await tx.user.updateMany({
          where: {
            id: target.customer.id,
            role: "customer",
            status: "active",
            fullName: null,
            dateOfBirth: null,
            email: null,
            phone: null,
            normalizedPhone: null,
            phoneVerifiedAt: null,
            phoneOtpDispatchClaimedUntil: null,
            rewardBalance: 0
          },
          data: {
            fullName: CUSTOMER_FULL_NAME,
            dateOfBirth: CUSTOMER_DATE_OF_BIRTH,
            phone: CUSTOMER_PHONE,
            normalizedPhone: getNormalizedPhone(target.customer.id),
            phoneVerifiedAt: now
          }
        });
        const doctorUpdate = await tx.user.updateMany({
          where: {
            id: target.doctor.id,
            role: "customer",
            status: "active",
            fullName: null,
            dateOfBirth: null,
            email: null,
            phone: null,
            normalizedPhone: null,
            phoneVerifiedAt: null,
            phoneOtpDispatchClaimedUntil: null,
            rewardBalance: 0
          },
          data: { fullName: DOCTOR_FULL_NAME, role: "doctor" }
        });
        if (customerUpdate.count !== 1 || doctorUpdate.count !== 1) {
          fail(FAILURE_CODES.TRANSACTION_CONFLICT, "transaction");
        }
        await tx.doctor.create({
          data: {
            userId: target.doctor.id,
            licenseNumber: null,
            specialty: DOCTOR_SPECIALTY,
            bio: DOCTOR_BIO,
            consultationFee: 0,
            status: "approved",
            approvedAt: now
          }
        });
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: AUDIT_ACTION,
            entityType: AUDIT_ENTITY_TYPE,
            entityId: target.customer.id,
            metadataJson: {
              accountType: "customer",
              controlled: true,
              fingerprint: target.fingerprint,
              runner: VERSION,
              testOnly: true
            },
            createdAt: now
          }
        });
        await tx.auditLog.create({
          data: {
            actorId: null,
            action: AUDIT_ACTION,
            entityType: AUDIT_ENTITY_TYPE,
            entityId: target.doctor.id,
            metadataJson: {
              accountType: "doctor",
              controlled: true,
              fingerprint: target.fingerprint,
              runner: VERSION,
              testOnly: true
            },
            createdAt: now
          }
        });
        const verified = await resolveCandidates(tx, options, databaseIdentityHash);
        if (!verified.replay || !hashesMatch(verified.fingerprint, target.fingerprint)) {
          fail(FAILURE_CODES.AUDIT_PROVENANCE_INVALID, "integrity");
        }
        return safeResult("apply", target.fingerprint, false);
      },
      { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 }
    );
  }

  const target = await resolveCandidates(prisma, options, databaseIdentityHash);
  await assertNoBusinessRecords(prisma, target.customer.id, target.doctor.id);
  if (options.mode === "precheck") {
    return {
      status: "ok",
      mode: "precheck",
      stage: "complete",
      databaseIdentity: "matched",
      schema: "ready",
      accountState: target.replay ? "bootstrapped" : "eligible",
      fingerprint: target.fingerprint,
      replayed: target.replay,
      counts: { accounts: 2, audits: target.replay ? 2 : 0 }
    };
  }
  if (!hashesMatch(target.fingerprint, options.targetFingerprint)) {
    fail(FAILURE_CODES.TARGET_FINGERPRINT_MISMATCH, "target");
  }
  if (!target.replay) fail(FAILURE_CODES.TARGET_STATE_INVALID, "target");
  return safeResult("verify", target.fingerprint, true);
}

function getSafeMode(argv) {
  const value = argv.find((argument) => argument.startsWith("--mode="))?.slice(7);
  return MODES.has(value) ? value : "unknown";
}

function getSafeFailure(error) {
  if (error instanceof RunnerFailure && Object.values(FAILURE_CODES).includes(error.code)) {
    return { code: error.code, stage: SAFE_STAGES.has(error.stage) ? error.stage : "unknown" };
  }
  if (["P1000", "P1001", "P1002", "P1003", "P1008", "P1017"].includes(error?.code)) {
    return { code: FAILURE_CODES.DATABASE_UNAVAILABLE, stage: "database" };
  }
  if (["P2002", "P2028", "P2034"].includes(error?.code)) {
    return { code: FAILURE_CODES.TRANSACTION_CONFLICT, stage: "transaction" };
  }
  return { code: FAILURE_CODES.UNKNOWN_SAFE_FAILURE, stage: "unknown" };
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
  const options = parseBootstrapOptions(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const databaseIdentityHash = await assertDatabaseIdentity(prisma, options.databaseIdentityHash);
    await assertSchemaReadiness(prisma);
    console.log(JSON.stringify(await runBootstrap(prisma, options, databaseIdentityHash)));
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
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  CUSTOMER_DATE_OF_BIRTH,
  CUSTOMER_FULL_NAME,
  CUSTOMER_PHONE,
  DOCTOR_BIO,
  DOCTOR_FULL_NAME,
  DOCTOR_SPECIALTY,
  FAILURE_CODES,
  VERSION,
  assertNoBusinessRecords,
  exactMetadata,
  getNormalizedPhone,
  getSafeFailure,
  getSafeMode,
  getTargetFingerprint,
  parseBootstrapOptions,
  resolveCandidates,
  runBootstrap,
  writeSafeFailure
};
