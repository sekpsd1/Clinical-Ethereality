import type { AdminAppointmentCalendarData } from "@/features/admin/schedules/types";

export function moveCalendarDate(value: string, view: AdminAppointmentCalendarData["view"], direction: -1 | 1): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (view === "month") {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + direction);
  } else {
    date.setUTCDate(date.getUTCDate() + direction * (view === "week" ? 7 : 1));
  }

  return date.toISOString().slice(0, 10);
}
