import type { ConsultationStatus, Prisma } from "@prisma/client";

export const LOCKING_CONSULTATION_STATUSES: ConsultationStatus[] = ["pending_payment", "scheduled", "live"];
export const CONSULTATION_SLOT_LOCK_TTL_MINUTES = 15;

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
