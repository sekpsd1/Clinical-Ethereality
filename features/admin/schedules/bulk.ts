import type { CreateDoctorAvailabilityBatchInput } from "@/features/admin/schedules/schema";

export type BatchAvailabilityRecord = {
  doctorId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  isActive: boolean;
  notes: string | null;
};

export type ExistingAvailabilityRange = Pick<BatchAvailabilityRecord, "weekday" | "startTime" | "endTime" | "slotMinutes">;

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function buildBatchAvailabilityRecords(input: CreateDoctorAvailabilityBatchInput): BatchAvailabilityRecord[] {
  const weekdays = [...input.weekdays].sort((left, right) => left - right);

  return weekdays.flatMap((weekday) =>
    input.blocks.map((block) => ({
      doctorId: input.doctorId,
      weekday,
      startTime: block.startTime,
      endTime: block.endTime,
      slotMinutes: block.slotMinutes,
      isActive: input.isActive,
      notes: input.notes?.trim() || null
    }))
  );
}

export function findExistingAvailabilityConflict(
  existing: ExistingAvailabilityRange[],
  requested: BatchAvailabilityRecord[]
): "duplicate" | "overlap" | null {
  for (const request of requested) {
    const requestStart = timeToMinutes(request.startTime);
    const requestEnd = timeToMinutes(request.endTime);

    for (const saved of existing) {
      if (saved.weekday !== request.weekday) {
        continue;
      }

      if (
        saved.startTime === request.startTime &&
        saved.endTime === request.endTime &&
        saved.slotMinutes === request.slotMinutes
      ) {
        return "duplicate";
      }

      const savedStart = timeToMinutes(saved.startTime);
      const savedEnd = timeToMinutes(saved.endTime);

      if (requestStart < savedEnd && savedStart < requestEnd) {
        return "overlap";
      }
    }
  }

  return null;
}
