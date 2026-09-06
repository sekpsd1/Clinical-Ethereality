import type { Prisma } from "@prisma/client";
import {
  formatBangkokTime,
  getBangkokCalendarDateKey
} from "@/features/consultations/booking/slots";

export type BlockedDateOverride = {
  scheduleDate: Date;
  type: "available" | "blocked" | "closed";
  startTime: string | null;
  endTime: string | null;
};

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isSlotBlockedByDateOverride(
  overrides: BlockedDateOverride[],
  scheduledAt: Date,
  slotMinutes: number
): boolean {
  const dateValue = getBangkokCalendarDateKey(scheduledAt);
  const slotStart = timeToMinutes(formatBangkokTime(scheduledAt));
  const slotEnd = slotStart + slotMinutes;

  return overrides.some((override) => {
    if (
      override.type !== "blocked" ||
      override.scheduleDate.toISOString().slice(0, 10) !== dateValue ||
      !override.startTime ||
      !override.endTime
    ) {
      return false;
    }

    const blockStart = timeToMinutes(override.startTime);
    const blockEnd = timeToMinutes(override.endTime);
    return slotStart < blockEnd && blockStart < slotEnd;
  });
}

export async function findActiveBlockingOverrideForSlot(
  tx: Pick<Prisma.TransactionClient, "doctorAvailabilityDateOverride">,
  input: { doctorId: string; scheduledAt: Date; slotMinutes: number }
) {
  const dateValue = getBangkokCalendarDateKey(input.scheduledAt);
  const endTime = formatBangkokTime(
    new Date(input.scheduledAt.getTime() + input.slotMinutes * 60 * 1000)
  );

  return tx.doctorAvailabilityDateOverride.findFirst({
    where: {
      doctorId: input.doctorId,
      scheduleDate: new Date(`${dateValue}T00:00:00.000Z`),
      isActive: true,
      OR: [
        { type: "closed" },
        {
          type: "blocked",
          startTime: { lt: endTime },
          endTime: { gt: formatBangkokTime(input.scheduledAt) }
        }
      ]
    },
    select: { id: true }
  });
}
