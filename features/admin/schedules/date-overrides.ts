export type DateOverrideTimeBlock = {
  startTime: string;
  endTime: string;
  slotMinutes: number;
};

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function hasOverlappingTimeBlock(existingBlocks: DateOverrideTimeBlock[], candidate: DateOverrideTimeBlock): boolean {
  const candidateStart = timeToMinutes(candidate.startTime);
  const candidateEnd = timeToMinutes(candidate.endTime);

  return existingBlocks.some((block) => {
    const existingStart = timeToMinutes(block.startTime);
    const existingEnd = timeToMinutes(block.endTime);

    return candidateStart < existingEnd && existingStart < candidateEnd;
  });
}

export function parseScheduleDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatScheduleDateValue(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function getBangkokDayRange(value: Date): { start: Date; end: Date } {
  const scheduleDate = formatScheduleDateValue(value);
  const start = new Date(`${scheduleDate}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
