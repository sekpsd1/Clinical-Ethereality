/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const CUSTOMER_LABEL = "sekmon";
const DOCTOR_LABEL = "websthai";
const FIXTURE_PREFIX = "[UAT] Controlled non-monetary Zoom UAT";
const FIXTURE_ACTION_CREATED = "consultation.zoom_uat_fixture_created";
const FIXTURE_ACTION_CANCELLED = "consultation.zoom_uat_fixture_cancelled";
const ACTIVE_CONSULTATION_STATUSES = ["requested", "pending_payment", "scheduled", "live"];
const ALLOWED_VERIFY_STATUSES = new Set(["scheduled", "live", "cancelled"]);
const FIXTURE_DURATION_MINUTES = 30;
const MAX_SUPPORTED_BOOKED_DURATION_MINUTES = 720;

function parseArguments(argv) {
  const values = new Map();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      throw new Error("Unsupported positional argument.");
    }

    if (argument === "--confirm-production") {
      if (values.has("confirm-production")) {
        throw new Error("Duplicate argument.");
      }
      values.set("confirm-production", true);
      continue;
    }

    const separator = argument.indexOf("=");
    if (separator <= 2) {
      throw new Error("Arguments must use --name=value.");
    }

    const name = argument.slice(2, separator);
    const value = argument.slice(separator + 1);
    if (!value) {
      throw new Error(`Missing argument value: ${name}.`);
    }
    if (values.has(name)) {
      throw new Error(`Duplicate argument: ${name}.`);
    }
    values.set(name, value);
  }

  return values;
}

function requiredArgument(values, name) {
  const value = values.get(name);
  if (!value || value === true) {
    throw new Error(`Missing required argument: ${name}.`);
  }
  return value;
}

function parseScheduledAt(value) {
  const scheduledAt = new Date(value);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.toISOString() !== value) {
    throw new Error("scheduled-at must be an ISO UTC timestamp.");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("scheduled-at must be in the future.");
  }
  return scheduledAt;
}

function validateFixtureKey(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,80}$/.test(value)) {
    throw new Error("fixture-key format is invalid.");
  }
  return value;
}

function parseRunnerOptions(argv, environment = process.env) {
  const values = parseArguments(argv);
  const mode = requiredArgument(values, "mode");
  if (!new Set(["precheck", "create", "verify", "cleanup"]).has(mode)) {
    throw new Error("Unsupported mode.");
  }
  if (values.get("confirm-production") !== true || environment.NODE_ENV !== "production") {
    throw new Error("Production confirmation is required.");
  }

  const fixtureKey = validateFixtureKey(requiredArgument(values, "fixture-key"));
  const customerLabel = requiredArgument(values, "customer-label");
  const doctorLabel = requiredArgument(values, "doctor-label");
  if (customerLabel !== CUSTOMER_LABEL || doctorLabel !== DOCTOR_LABEL) {
    throw new Error("Unexpected UAT account labels.");
  }

  const scheduledAt = parseScheduledAt(requiredArgument(values, "scheduled-at"));
  const targetFingerprint = mode === "precheck" ? null : requiredArgument(values, "target-fingerprint");
  const expectedStatus = values.get("expected-status") ?? "scheduled";
  if (!ALLOWED_VERIFY_STATUSES.has(expectedStatus)) {
    throw new Error("Unsupported expected status.");
  }

  return {
    customerLabel,
    doctorLabel,
    expectedStatus,
    fixtureKey,
    mode,
    scheduledAt,
    targetFingerprint
  };
}

function getFixtureSummary(fixtureKey) {
  return `${FIXTURE_PREFIX}; key=${fixtureKey}`;
}

function maskIdentifier(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function getTargetFingerprint(target, fixtureKey, scheduledAt) {
  return crypto
    .createHash("sha256")
    .update(`${target.customer.id}:${target.doctor.id}:${fixtureKey}:${scheduledAt.toISOString()}`)
    .digest("hex");
}

function getSafeTarget(target) {
  return {
    customer: maskIdentifier(target.customer.id),
    doctor: maskIdentifier(target.doctor.id),
    doctorUser: maskIdentifier(target.doctor.userId)
  };
}

function getFixtureCounts(integrity) {
  return {
    audit: integrity.auditCount,
    consultation: 1,
    order: integrity.orderCount,
    payment: integrity.paymentCount,
    prescription: integrity.prescriptionCount,
    slipAttachment: integrity.slipAttachmentCount
  };
}

function getOverlap(consultations, scheduledAt) {
  const fixtureEnd = new Date(scheduledAt.getTime() + FIXTURE_DURATION_MINUTES * 60_000);

  for (const consultation of consultations) {
    if (!consultation.scheduledAt) {
      continue;
    }
    const duration = consultation.bookedDurationMinutes ?? FIXTURE_DURATION_MINUTES;
    if (!Number.isInteger(duration) || duration <= 0 || duration > MAX_SUPPORTED_BOOKED_DURATION_MINUTES) {
      throw new Error("Existing consultation duration is outside the supported safe range.");
    }
    const consultationEnd = new Date(consultation.scheduledAt.getTime() + duration * 60_000);
    if (consultation.scheduledAt < fixtureEnd && consultationEnd > scheduledAt) {
      return consultation;
    }
  }

  return null;
}

async function resolveTarget(prisma, options) {
  const [customers, doctors] = await Promise.all([
    prisma.user.findMany({
      where: {
        displayName: options.customerLabel,
        role: "customer",
        status: "active"
      },
      select: { id: true },
      take: 2
    }),
    prisma.doctor.findMany({
      where: {
        status: "approved",
        user: {
          displayName: options.doctorLabel,
          role: "doctor",
          status: "active"
        }
      },
      select: { id: true, userId: true },
      take: 2
    })
  ]);

  if (customers.length !== 1 || doctors.length !== 1) {
    throw new Error("Expected UAT identities are not uniquely eligible.");
  }

  return {
    customer: customers[0],
    doctor: doctors[0]
  };
}

async function findFixture(prisma, target, fixtureKey) {
  const fixtures = await prisma.consultation.findMany({
    where: {
      doctorId: target.doctor.id,
      patientId: target.customer.id,
      summary: getFixtureSummary(fixtureKey)
    },
    select: {
      bookedDurationMinutes: true,
      doctorId: true,
      id: true,
      patientId: true,
      scheduledAt: true,
      status: true,
      summary: true,
      zoomMeetingId: true
    },
    take: 2
  });

  if (fixtures.length > 1) {
    throw new Error("Fixture key is not unique.");
  }
  return fixtures[0] ?? null;
}

async function assertNoSlotOverlap(prisma, target, scheduledAt) {
  const lookback = new Date(scheduledAt.getTime() - MAX_SUPPORTED_BOOKED_DURATION_MINUTES * 60_000);
  const fixtureEnd = new Date(scheduledAt.getTime() + FIXTURE_DURATION_MINUTES * 60_000);
  const [consultations, slotLock] = await Promise.all([
    prisma.consultation.findMany({
      where: {
        doctorId: target.doctor.id,
        scheduledAt: {
          gte: lookback,
          lt: fixtureEnd
        },
        status: { in: ACTIVE_CONSULTATION_STATUSES }
      },
      select: { bookedDurationMinutes: true, scheduledAt: true }
    }),
    prisma.consultationSlotLock.findFirst({
      where: {
        doctorId: target.doctor.id,
        scheduledAt
      },
      select: { id: true }
    })
  ]);

  if (slotLock || getOverlap(consultations, scheduledAt)) {
    throw new Error("The requested UAT slot is unavailable.");
  }
}

async function getFixtureIntegrity(prisma, fixture) {
  const [paymentCount, slipAttachmentCount, prescriptionCount, orderCount, auditCount] = await Promise.all([
    prisma.payment.count({ where: { consultationId: fixture.id } }),
    prisma.fileAttachment.count({
      where: {
        entityId: fixture.id,
        entityType: "consultation",
        purpose: "payment_slip"
      }
    }),
    prisma.prescription.count({ where: { consultationId: fixture.id } }),
    prisma.orderItem.count({ where: { prescription: { is: { consultationId: fixture.id } } } }),
    prisma.auditLog.count({
      where: {
        action: { in: [FIXTURE_ACTION_CREATED, FIXTURE_ACTION_CANCELLED] },
        entityId: fixture.id,
        entityType: "consultation"
      }
    })
  ]);

  return { auditCount, orderCount, paymentCount, prescriptionCount, slipAttachmentCount };
}

function assertFixtureIntegrity(fixture, integrity, expectedStatus) {
  if (
    fixture.status !== expectedStatus ||
    fixture.bookedDurationMinutes !== FIXTURE_DURATION_MINUTES ||
    !fixture.scheduledAt ||
    integrity.paymentCount !== 0 ||
    integrity.slipAttachmentCount !== 0 ||
    integrity.prescriptionCount !== 0 ||
    integrity.orderCount !== 0
  ) {
    throw new Error("Fixture integrity check failed.");
  }
}

function assertTargetFingerprint(target, options) {
  if (getTargetFingerprint(target, options.fixtureKey, options.scheduledAt) !== options.targetFingerprint) {
    throw new Error("Target fingerprint does not match the approved fixture plan.");
  }
}

function safeResult(mode, target, fixture, integrity, fixtureKey, scheduledAt) {
  return {
    counts: integrity
      ? getFixtureCounts(integrity)
      : { audit: 0, consultation: fixture ? 1 : 0, order: 0, payment: 0, prescription: 0, slipAttachment: 0 },
    fixture: fixture
      ? {
          id: maskIdentifier(fixture.id),
          scheduledAt: fixture.scheduledAt?.toISOString() ?? null,
          status: fixture.status,
          zoomMeetingPresent: Boolean(fixture.zoomMeetingId)
        }
      : null,
    fixtureKey,
    mode,
    scheduledAt: scheduledAt.toISOString(),
    target: getSafeTarget(target),
    targetFingerprint: getTargetFingerprint(target, fixtureKey, scheduledAt)
  };
}

async function runFixtureRunner(prisma, options) {
  const target = await resolveTarget(prisma, options);

  if (options.mode === "precheck") {
    const existingFixture = await findFixture(prisma, target, options.fixtureKey);
    if (existingFixture) {
      throw new Error("Fixture key has already been used.");
    }
    await assertNoSlotOverlap(prisma, target, options.scheduledAt);
    return safeResult("precheck", target, null, null, options.fixtureKey, options.scheduledAt);
  }

  assertTargetFingerprint(target, options);

  if (options.mode === "create") {
    return prisma.$transaction(
      async (transaction) => {
        const existingFixture = await findFixture(transaction, target, options.fixtureKey);
        if (existingFixture) {
          throw new Error("Fixture key has already been used.");
        }
        await assertNoSlotOverlap(transaction, target, options.scheduledAt);

        const fixture = await transaction.consultation.create({
          data: {
            bookedDurationMinutes: FIXTURE_DURATION_MINUTES,
            doctorId: target.doctor.id,
            patientId: target.customer.id,
            scheduledAt: options.scheduledAt,
            status: "scheduled",
            summary: getFixtureSummary(options.fixtureKey)
          },
          select: {
            bookedDurationMinutes: true,
            doctorId: true,
            id: true,
            patientId: true,
            scheduledAt: true,
            status: true,
            summary: true,
            zoomMeetingId: true
          }
        });
        const beforeAuditIntegrity = await getFixtureIntegrity(transaction, fixture);
        if (beforeAuditIntegrity.auditCount !== 0) {
          throw new Error("Unexpected audit state for new fixture.");
        }
        assertFixtureIntegrity(fixture, beforeAuditIntegrity, "scheduled");

        await transaction.auditLog.create({
          data: {
            action: FIXTURE_ACTION_CREATED,
            entityId: fixture.id,
            entityType: "consultation",
            metadataJson: {
              controlled: true,
              fixtureKey: options.fixtureKey,
              nonMonetary: true,
              nonRecording: true,
              targetFingerprint: options.targetFingerprint
            }
          }
        });

        const afterAuditIntegrity = await getFixtureIntegrity(transaction, fixture);
        if (afterAuditIntegrity.auditCount !== 1) {
          throw new Error("Fixture audit was not recorded exactly once.");
        }
        return safeResult("create", target, fixture, afterAuditIntegrity, options.fixtureKey, options.scheduledAt);
      },
      { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 }
    );
  }

  const fixture = await findFixture(prisma, target, options.fixtureKey);
  if (!fixture) {
    throw new Error("Fixture was not found.");
  }

  if (options.mode === "verify") {
    const integrity = await getFixtureIntegrity(prisma, fixture);
    assertFixtureIntegrity(fixture, integrity, options.expectedStatus);
    if (integrity.auditCount < 1) {
      throw new Error("Fixture audit is missing.");
    }
    return safeResult("verify", target, fixture, integrity, options.fixtureKey, options.scheduledAt);
  }

  return prisma.$transaction(
    async (transaction) => {
      const currentFixture = await findFixture(transaction, target, options.fixtureKey);
      if (!currentFixture) {
        throw new Error("Fixture was not found.");
      }
      const beforeCleanupIntegrity = await getFixtureIntegrity(transaction, currentFixture);
      if (currentFixture.status === "cancelled") {
        assertFixtureIntegrity(currentFixture, beforeCleanupIntegrity, "cancelled");
        return safeResult("cleanup", target, currentFixture, beforeCleanupIntegrity, options.fixtureKey, options.scheduledAt);
      }
      if (!new Set(["scheduled", "live"]).has(currentFixture.status)) {
        throw new Error("Fixture is not safe to cancel.");
      }
      assertFixtureIntegrity(currentFixture, beforeCleanupIntegrity, currentFixture.status);

      const updated = await transaction.consultation.updateMany({
        where: {
          doctorId: target.doctor.id,
          id: currentFixture.id,
          patientId: target.customer.id,
          status: currentFixture.status,
          summary: getFixtureSummary(options.fixtureKey)
        },
        data: { status: "cancelled" }
      });
      if (updated.count !== 1) {
        throw new Error("Fixture cleanup compare-and-swap failed.");
      }
      await transaction.auditLog.create({
        data: {
          action: FIXTURE_ACTION_CANCELLED,
          entityId: currentFixture.id,
          entityType: "consultation",
          metadataJson: {
            controlled: true,
            fixtureKey: options.fixtureKey,
            targetFingerprint: options.targetFingerprint
          }
        }
      });
      const cancelledFixture = await findFixture(transaction, target, options.fixtureKey);
      const afterCleanupIntegrity = await getFixtureIntegrity(transaction, cancelledFixture);
      assertFixtureIntegrity(cancelledFixture, afterCleanupIntegrity, "cancelled");
      if (afterCleanupIntegrity.auditCount < 2) {
        throw new Error("Fixture cleanup audit is missing.");
      }
      return safeResult("cleanup", target, cancelledFixture, afterCleanupIntegrity, options.fixtureKey, options.scheduledAt);
    },
    { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 }
  );
}

async function main() {
  const options = parseRunnerOptions(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const result = await runFixtureRunner(prisma, options);
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error("Zoom UAT fixture runner stopped safely.");
    process.exitCode = 1;
  });
}

module.exports = {
  ACTIVE_CONSULTATION_STATUSES,
  CUSTOMER_LABEL,
  DOCTOR_LABEL,
  FIXTURE_ACTION_CANCELLED,
  FIXTURE_ACTION_CREATED,
  FIXTURE_DURATION_MINUTES,
  getFixtureSummary,
  getOverlap,
  getTargetFingerprint,
  maskIdentifier,
  parseRunnerOptions,
  resolveTarget,
  runFixtureRunner
};
