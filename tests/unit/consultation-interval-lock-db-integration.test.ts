import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config({ path: ".env.local", quiet: true });

const { prisma } = await import("@/lib/db/prisma");
const {
  findActiveConsultationIntervalConflict,
  lockDoctorConsultationSchedule
} = await import("@/features/consultations/booking/interval-lock");

const describeWithLocalDatabase =
  process.env.RUN_LOCAL_DB_INTEGRATION === "true" ? describe : describe.skip;

function assertDisposableLocalDatabase(): void {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("Local integration database is not configured.");
  const url = new URL(value);
  const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  if (
    !isLoopback ||
    url.port !== "3307" ||
    url.pathname.replace(/^\//, "") !== "clinical_interval_test"
  ) {
    throw new Error("Refusing to write outside the disposable local integration database.");
  }
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describeWithLocalDatabase("Consultation interval lock Local DB integration", () => {
  const fixtureKey = randomUUID();
  const scheduledAt = new Date("2099-01-01T10:00:00.000Z");
  const overlappingAt = new Date("2099-01-01T10:15:00.000Z");
  const adjacentAt = new Date("2099-01-01T10:30:00.000Z");
  const now = new Date("2098-12-31T00:00:00.000Z");
  let doctorUserId = "";
  let firstPatientId = "";
  let secondPatientId = "";
  let doctorId = "";
  let firstConsultationId = "";
  let firstSlotLockId = "";
  let adjacentConsultationId = "";
  let adjacentSlotLockId = "";

  beforeAll(async () => {
    assertDisposableLocalDatabase();
    const [doctorUser, firstPatient, secondPatient] = await Promise.all([
      prisma.user.create({
        data: {
          lineUserId: `interval-doctor-${fixtureKey}`,
          displayName: "Interval integration doctor",
          role: "doctor",
          status: "active"
        },
        select: { id: true }
      }),
      prisma.user.create({
        data: {
          lineUserId: `interval-patient-a-${fixtureKey}`,
          displayName: "Interval integration patient A",
          role: "customer",
          status: "active"
        },
        select: { id: true }
      }),
      prisma.user.create({
        data: {
          lineUserId: `interval-patient-b-${fixtureKey}`,
          displayName: "Interval integration patient B",
          role: "customer",
          status: "active"
        },
        select: { id: true }
      })
    ]);
    doctorUserId = doctorUser.id;
    firstPatientId = firstPatient.id;
    secondPatientId = secondPatient.id;

    const doctor = await prisma.doctor.create({
      data: {
        userId: doctorUserId,
        status: "approved",
        consultationFee: 900
      },
      select: { id: true }
    });
    doctorId = doctor.id;

    const slotLock = await prisma.consultationSlotLock.create({
      data: {
        doctorId,
        patientId: firstPatientId,
        scheduledAt,
        expiresAt: new Date("2098-12-30T00:00:00.000Z")
      },
      select: { id: true }
    });
    firstSlotLockId = slotLock.id;
    const consultation = await prisma.consultation.create({
      data: {
        patientId: firstPatientId,
        doctorId,
        slotLockId: firstSlotLockId,
        scheduledAt,
        bookedDurationMinutes: 30,
        status: "pending_payment"
      },
      select: { id: true }
    });
    firstConsultationId = consultation.id;
  });

  afterAll(async () => {
    const consultationIds = [firstConsultationId, adjacentConsultationId].filter(Boolean);
    const slotLockIds = [firstSlotLockId, adjacentSlotLockId].filter(Boolean);
    if (consultationIds.length > 0) {
      await prisma.consultation.deleteMany({ where: { id: { in: consultationIds } } });
    }
    if (slotLockIds.length > 0) {
      await prisma.consultationSlotLock.deleteMany({ where: { id: { in: slotLockIds } } });
    }
    if (doctorId) await prisma.doctor.deleteMany({ where: { id: doctorId } });
    const userIds = [doctorUserId, firstPatientId, secondPatientId].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("serializes a confirmation transition before an overlapping distinct-start booking", async () => {
    const confirmationHasDoctorLock = deferred();
    const releaseConfirmation = deferred();
    const bookingRequestedDoctorLock = deferred();

    const confirmation = prisma.$transaction(
      async (tx) => {
        await lockDoctorConsultationSchedule(tx, doctorId);
        confirmationHasDoctorLock.resolve();
        await releaseConfirmation.promise;

        const conflict = await findActiveConsultationIntervalConflict(tx, {
          doctorId,
          scheduledAt,
          durationMinutes: 30,
          excludeConsultationId: firstConsultationId,
          excludeSlotLockId: firstSlotLockId,
          now
        });
        expect(conflict).toBeNull();
        await tx.consultation.update({
          where: { id: firstConsultationId },
          data: { status: "scheduled" }
        });
        return "scheduled" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }
    );

    await confirmationHasDoctorLock.promise;
    const booking = prisma.$transaction(
      async (tx) => {
        bookingRequestedDoctorLock.resolve();
        await lockDoctorConsultationSchedule(tx, doctorId);
        const conflict = await findActiveConsultationIntervalConflict(tx, {
          doctorId,
          scheduledAt: overlappingAt,
          durationMinutes: 15,
          now
        });
        return conflict ? "blocked" as const : "available" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }
    );

    await bookingRequestedDoctorLock.promise;
    const stayedBlocked = await Promise.race([
      booking.then(() => false),
      new Promise<true>((resolve) => setTimeout(() => resolve(true), 150))
    ]);
    expect(stayedBlocked).toBe(true);
    releaseConfirmation.resolve();

    await expect(confirmation).resolves.toBe("scheduled");
    await expect(booking).resolves.toBe("blocked");
  });

  it("allows an adjacent half-open interval after the confirmed legacy consultation", async () => {
    const result = await prisma.$transaction(
      async (tx) => {
        await lockDoctorConsultationSchedule(tx, doctorId);
        const conflict = await findActiveConsultationIntervalConflict(tx, {
          doctorId,
          scheduledAt: adjacentAt,
          durationMinutes: 15,
          now
        });
        if (conflict) return "blocked" as const;

        const slotLock = await tx.consultationSlotLock.create({
          data: {
            doctorId,
            patientId: secondPatientId,
            scheduledAt: adjacentAt,
            expiresAt: null
          },
          select: { id: true }
        });
        adjacentSlotLockId = slotLock.id;
        const consultation = await tx.consultation.create({
          data: {
            patientId: secondPatientId,
            doctorId,
            slotLockId: slotLock.id,
            scheduledAt: adjacentAt,
            bookedDurationMinutes: 15,
            status: "scheduled"
          },
          select: { id: true }
        });
        adjacentConsultationId = consultation.id;
        return "created" as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    expect(result).toBe("created");
  });
});
