import { Prisma } from "@prisma/client";
import {
  getActiveConsultationSlotWhere
} from "@/features/consultations/booking/slots";
import {
  getBookedConsultationDurationMinutes,
  LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES
} from "@/features/consultations/duration-policy";

const MAX_SUPPORTED_CONSULTATION_DURATION_MINUTES = 60;

export type ConsultationInterval = {
  start: Date;
  end: Date;
};

export function getConsultationInterval(
  scheduledAt: Date,
  durationMinutes?: number | null
): ConsultationInterval {
  const minutes = getBookedConsultationDurationMinutes(durationMinutes);
  return {
    start: scheduledAt,
    end: new Date(scheduledAt.getTime() + minutes * 60 * 1000)
  };
}

export function consultationIntervalsOverlap(
  left: ConsultationInterval,
  right: ConsultationInterval
): boolean {
  return left.start < right.end && right.start < left.end;
}

export function doesConsultationTimeOverlap(input: {
  candidateDurationMinutes?: number | null;
  candidateScheduledAt: Date;
  existingDurationMinutes?: number | null;
  existingScheduledAt: Date;
}): boolean {
  return consultationIntervalsOverlap(
    getConsultationInterval(
      input.candidateScheduledAt,
      input.candidateDurationMinutes
    ),
    getConsultationInterval(
      input.existingScheduledAt,
      input.existingDurationMinutes
    )
  );
}

export async function lockDoctorConsultationSchedule(
  tx: Prisma.TransactionClient,
  doctorId: string
): Promise<void> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT \`id\` FROM \`Doctor\` WHERE \`id\` = ${doctorId} FOR UPDATE`
  );
  if (locked.length !== 1) {
    throw new Error("Doctor schedule is unavailable.");
  }
}

export async function findActiveConsultationIntervalConflict(
  tx: Prisma.TransactionClient,
  input: {
    doctorId: string;
    scheduledAt: Date;
    durationMinutes?: number | null;
    excludeConsultationId?: string;
    excludeSlotLockId?: string;
    now?: Date;
  }
): Promise<{ kind: "consultation" | "slot_lock"; id: string } | null> {
  const now = input.now ?? new Date();
  const candidate = getConsultationInterval(
    input.scheduledAt,
    input.durationMinutes
  );
  const lookupStart = new Date(
    candidate.start.getTime() -
      MAX_SUPPORTED_CONSULTATION_DURATION_MINUTES * 60 * 1000
  );

  const consultations = await tx.consultation.findMany({
    where: {
      ...(input.excludeConsultationId
        ? { id: { not: input.excludeConsultationId } }
        : {}),
      doctorId: input.doctorId,
      scheduledAt: { gte: lookupStart, lt: candidate.end },
      ...getActiveConsultationSlotWhere(now)
    },
    select: { id: true, scheduledAt: true, bookedDurationMinutes: true }
  });

  const consultationConflict = consultations.find(
    (consultation) =>
      consultation.scheduledAt &&
      consultationIntervalsOverlap(
        candidate,
        getConsultationInterval(
          consultation.scheduledAt,
          consultation.bookedDurationMinutes
        )
      )
  );
  if (consultationConflict) {
    return { kind: "consultation", id: consultationConflict.id };
  }

  const locks = await tx.consultationSlotLock.findMany({
    where: {
      ...(input.excludeSlotLockId ? { id: { not: input.excludeSlotLockId } } : {}),
      doctorId: input.doctorId,
      scheduledAt: { gte: lookupStart, lt: candidate.end },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: {
      id: true,
      scheduledAt: true,
      availabilityId: true,
      consultation: { select: { bookedDurationMinutes: true } }
    }
  });
  if (locks.length === 0) return null;

  const sourceIds = locks.flatMap((lock) =>
    lock.availabilityId ? [lock.availabilityId] : []
  );
  const [weeklySources, dateSources] =
    sourceIds.length === 0
      ? [[], []]
      : await Promise.all([
          tx.doctorAvailability.findMany({
            where: { id: { in: sourceIds } },
            select: { id: true, slotMinutes: true }
          }),
          tx.doctorAvailabilityDateOverride.findMany({
            where: { id: { in: sourceIds } },
            select: { id: true, slotMinutes: true }
          })
        ]);
  const durationBySource = new Map(
    [...weeklySources, ...dateSources].map((source) => [
      source.id,
      source.slotMinutes ?? LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES
    ])
  );
  const lockConflict = locks.find((lock) => {
    const durationMinutes =
      lock.consultation?.bookedDurationMinutes ??
      (lock.availabilityId ? durationBySource.get(lock.availabilityId) : null) ??
      LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES;
    return consultationIntervalsOverlap(
      candidate,
      getConsultationInterval(lock.scheduledAt, durationMinutes)
    );
  });

  return lockConflict ? { kind: "slot_lock", id: lockConflict.id } : null;
}
