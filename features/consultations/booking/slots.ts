import type { ConsultationStatus, Prisma } from "@prisma/client";

export const LOCKING_CONSULTATION_STATUSES: ConsultationStatus[] = ["pending_payment", "scheduled", "live"];
export const CONSULTATION_SLOT_LOCK_TTL_MINUTES = 15;
export const CLINIC_TIME_ZONE = "Asia/Bangkok";

function getBangkokDateParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: values.year, month: values.month, day: values.day };
}

function addDaysToCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getBangkokWeekday(date: Date): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "short"
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function getBangkokCalendarDateKey(date: Date): string {
  const { year, month, day } = getBangkokDateParts(date);
  return `${year}-${month}-${day}`;
}

export function formatBangkokTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export function getScheduledAtForCalendarDate(scheduleDate: string, startTime: string): Date {
  const [hour, minute] = startTime.split(":").map(Number);
  return new Date(`${scheduleDate}T${String(hour ?? 9).padStart(2, "0")}:${String(minute ?? 0).padStart(2, "0")}:00+07:00`);
}

export function getScheduledSlotTimes(scheduledAt: Date, startTime: string, endTime: string, slotMinutes: number): Date[] {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = (startHour ?? 0) * 60 + (startMinute ?? 0);
  const end = (endHour ?? 0) * 60 + (endMinute ?? 0);
  const scheduleDate = getBangkokCalendarDateKey(scheduledAt);

  return Array.from({ length: Math.max(0, (end - start) / slotMinutes) }, (_, index) => {
    const minuteOfDay = start + index * slotMinutes;
    return getScheduledAtForCalendarDate(
      scheduleDate,
      `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`
    );
  });
}

export function getSlotLockExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + CONSULTATION_SLOT_LOCK_TTL_MINUTES * 60 * 1000);
}

export function isSlotLockActive(expiresAt: Date | null | undefined, now = new Date()): boolean {
  return !expiresAt || expiresAt > now;
}

export function getActiveConsultationSlotWhere(now = new Date()): Prisma.ConsultationWhereInput {
  return {
    OR: [
      {
        status: {
          in: ["scheduled", "live"]
        }
      },
      {
        status: "pending_payment",
        OR: [
          {
            slotLockId: null
          },
          {
            slotLock: {
              is: {
                expiresAt: null
              }
            }
          },
          {
            slotLock: {
              is: {
                expiresAt: {
                  gt: now
                }
              }
            }
          }
        ]
      }
    ]
  };
}

export function getUpcomingDateForWeekday(weekday: number, startTime: string, now = new Date()): Date {
  const today = getBangkokCalendarDateKey(now);
  const currentWeekday = getBangkokWeekday(now);
  const daysAhead = (weekday - currentWeekday + 7) % 7 || 7;
  return getScheduledAtForCalendarDate(addDaysToCalendarDate(today, daysAhead), startTime);
}

export function getScheduledAtForDate(scheduleDate: Date, startTime: string): Date {
  const value = `${scheduleDate.getUTCFullYear()}-${String(scheduleDate.getUTCMonth() + 1).padStart(2, "0")}-${String(scheduleDate.getUTCDate()).padStart(2, "0")}`;
  return getScheduledAtForCalendarDate(value, startTime);
}

export function getSlotTimestamp(date: Date): number {
  return date.getTime();
}
