import { Prisma } from "@prisma/client";
import {
  getBookedConsultationDurationMinutes
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

  const consultations = await tx.$queryRaw<Array<{
    id: string;
    scheduledAt: Date;
    durationMinutes: number | null;
  }>>(Prisma.sql`
    SELECT
      c.\`id\`,
      c.\`scheduledAt\`,
      c.\`bookedDurationMinutes\` AS \`durationMinutes\`
    FROM \`Consultation\` c
    LEFT JOIN \`ConsultationSlotLock\` l ON l.\`id\` = c.\`slotLockId\`
    WHERE c.\`doctorId\` = ${input.doctorId}
      AND c.\`scheduledAt\` >= ${lookupStart}
      AND c.\`scheduledAt\` < ${candidate.end}
      ${input.excludeConsultationId
        ? Prisma.sql`AND c.\`id\` <> ${input.excludeConsultationId}`
        : Prisma.empty}
      AND (
        c.\`status\` IN ('scheduled', 'live')
        OR (
          c.\`status\` = 'pending_payment'
          AND (
            c.\`slotLockId\` IS NULL
            OR l.\`expiresAt\` IS NULL
            OR l.\`expiresAt\` > ${now}
          )
        )
      )
    FOR UPDATE
  `);

  const consultationConflict = consultations.find(
    (consultation) =>
      consultation.scheduledAt &&
      consultationIntervalsOverlap(
        candidate,
        getConsultationInterval(
          consultation.scheduledAt,
          consultation.durationMinutes
        )
      )
  );
  if (consultationConflict) {
    return { kind: "consultation", id: consultationConflict.id };
  }

  const locks = await tx.$queryRaw<Array<{
    id: string;
    scheduledAt: Date;
    durationMinutes: number | null;
  }>>(Prisma.sql`
    SELECT
      l.\`id\`,
      l.\`scheduledAt\`,
      COALESCE(
        c.\`bookedDurationMinutes\`,
        a.\`slotMinutes\`,
        o.\`slotMinutes\`,
        30
      ) AS \`durationMinutes\`
    FROM \`ConsultationSlotLock\` l
    LEFT JOIN \`Consultation\` c ON c.\`slotLockId\` = l.\`id\`
    LEFT JOIN \`DoctorAvailability\` a ON a.\`id\` = l.\`availabilityId\`
    LEFT JOIN \`DoctorAvailabilityDateOverride\` o ON o.\`id\` = l.\`availabilityId\`
    WHERE l.\`doctorId\` = ${input.doctorId}
      AND l.\`scheduledAt\` >= ${lookupStart}
      AND l.\`scheduledAt\` < ${candidate.end}
      ${input.excludeSlotLockId
        ? Prisma.sql`AND l.\`id\` <> ${input.excludeSlotLockId}`
        : Prisma.empty}
      AND (l.\`expiresAt\` IS NULL OR l.\`expiresAt\` > ${now})
    FOR UPDATE
  `);
  if (locks.length === 0) return null;
  const lockConflict = locks.find((lock) => {
    return consultationIntervalsOverlap(
      candidate,
      getConsultationInterval(lock.scheduledAt, lock.durationMinutes)
    );
  });

  return lockConflict ? { kind: "slot_lock", id: lockConflict.id } : null;
}
