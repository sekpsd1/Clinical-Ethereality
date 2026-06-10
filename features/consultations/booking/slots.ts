import type { ConsultationStatus } from "@prisma/client";

export const LOCKING_CONSULTATION_STATUSES: ConsultationStatus[] = ["pending_payment", "scheduled", "live"];

export function getUpcomingDateForWeekday(weekday: number, startTime: string, now = new Date()): Date {
  const [hour, minute] = startTime.split(":").map(Number);
  const scheduledAt = new Date(now);
  const daysAhead = (weekday - now.getDay() + 7) % 7 || 7;

  scheduledAt.setDate(now.getDate() + daysAhead);
  scheduledAt.setHours(hour ?? 9, minute ?? 0, 0, 0);

  return scheduledAt;
}

export function getSlotTimestamp(date: Date): number {
  return date.getTime();
}
