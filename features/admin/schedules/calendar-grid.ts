const STANDARD_CALENDAR_START_MINUTES = 9 * 60;
const STANDARD_CALENDAR_END_MINUTES = 22 * 60;

// Matches the DoctorAvailability database default and keeps an empty calendar
// compatible with the existing availability-slot interval.
export const DEFAULT_ADMIN_CALENDAR_SLOT_MINUTES = 30;

function formatTimeLabel(totalMinutes: number): string {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

export function buildAdminCalendarTimeRows(timeLabels: string[]): string[] {
  const configuredRows = Array.from(new Set(timeLabels)).sort();

  if (configuredRows.length > 0) return configuredRows;

  return Array.from(
    { length: (STANDARD_CALENDAR_END_MINUTES - STANDARD_CALENDAR_START_MINUTES) / DEFAULT_ADMIN_CALENDAR_SLOT_MINUTES },
    (_, index) => formatTimeLabel(STANDARD_CALENDAR_START_MINUTES + index * DEFAULT_ADMIN_CALENDAR_SLOT_MINUTES)
  );
}

export function getSuggestedCalendarEndTime(startTime: string): string | undefined {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + DEFAULT_ADMIN_CALENDAR_SLOT_MINUTES;

  return Number.isFinite(startMinutes) && endMinutes < 24 * 60 ? formatTimeLabel(endMinutes) : undefined;
}
