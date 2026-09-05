import { describe, expect, it } from "vitest";
import {
  CONSULTATION_SLOT_LOCK_TTL_MINUTES,
  getActiveConsultationSlotWhere,
  getSlotLockExpiresAt,
  getSlotTimestamp,
  getUpcomingDateForWeekday,
  isSlotLockActive,
  LOCKING_CONSULTATION_STATUSES
} from "@/features/consultations/booking/slots";

describe("booking slot helpers", () => {
  it("keeps the current weekday while the availability still has time remaining", () => {
    const now = new Date("2026-09-05T15:00:00.000+07:00"); // Saturday
    const scheduledAt = getUpcomingDateForWeekday(6, "22:00", now);

    expect(scheduledAt.toISOString()).toBe("2026-09-05T15:00:00.000Z");
  });

  it("moves to the following week only after the current weekday availability ends", () => {
    const now = new Date("2026-09-05T22:00:00.000+07:00"); // Saturday
    const scheduledAt = getUpcomingDateForWeekday(6, "22:00", now);

    expect(scheduledAt.toISOString()).toBe("2026-09-12T15:00:00.000Z");
  });

  it("locks only active consultation states that reserve a doctor slot", () => {
    expect(LOCKING_CONSULTATION_STATUSES).toEqual(["pending_payment", "scheduled", "live"]);
  });

  it("normalizes date instances to stable timestamps for slot lock sets", () => {
    expect(getSlotTimestamp(new Date("2026-06-15T10:00:00.000Z"))).toBe(
      new Date("2026-06-15T10:00:00.000Z").getTime()
    );
  });

  it("creates short-lived payment holds instead of holding until the appointment slot ends", () => {
    const now = new Date("2026-06-10T10:00:00.000Z");
    const expiresAt = getSlotLockExpiresAt(now);

    expect(CONSULTATION_SLOT_LOCK_TTL_MINUTES).toBe(15);
    expect(expiresAt.toISOString()).toBe("2026-06-10T10:15:00.000Z");
  });

  it("treats expired payment holds as released", () => {
    const now = new Date("2026-06-10T10:16:00.000Z");

    expect(isSlotLockActive(new Date("2026-06-10T10:15:00.000Z"), now)).toBe(false);
    expect(isSlotLockActive(new Date("2026-06-10T10:17:00.000Z"), now)).toBe(true);
    expect(isSlotLockActive(null, now)).toBe(true);
  });

  it("only reserves pending payment consultations while their slot lock is active", () => {
    expect(getActiveConsultationSlotWhere(new Date("2026-06-10T10:00:00.000Z"))).toMatchObject({
      OR: [
        {
          status: {
            in: ["scheduled", "live"]
          }
        },
        {
          status: "pending_payment"
        }
      ]
    });
  });
});
