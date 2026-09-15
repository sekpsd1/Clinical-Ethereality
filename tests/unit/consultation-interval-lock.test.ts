import { describe, expect, it, vi } from "vitest";
import {
  consultationIntervalsOverlap,
  doesConsultationTimeOverlap,
  findActiveConsultationIntervalConflict,
  getConsultationInterval,
  lockDoctorConsultationSchedule
} from "@/features/consultations/booking/interval-lock";

describe("consultation interval locking", () => {
  it.each([15, 30, 45, 60])(
    "detects overlap against a historical %i-minute consultation in both directions",
    (minutes) => {
      const start = new Date("2026-09-15T10:00:00.000Z");
      expect(
        doesConsultationTimeOverlap({
          candidateScheduledAt: new Date(start.getTime() + 5 * 60 * 1000),
          candidateDurationMinutes: 15,
          existingScheduledAt: start,
          existingDurationMinutes: minutes
        })
      ).toBe(true);
      expect(
        doesConsultationTimeOverlap({
          candidateScheduledAt: start,
          candidateDurationMinutes: minutes,
          existingScheduledAt: new Date(start.getTime() + 5 * 60 * 1000),
          existingDurationMinutes: 15
        })
      ).toBe(true);
    }
  );

  it("allows adjacent half-open intervals", () => {
    expect(
      consultationIntervalsOverlap(
        getConsultationInterval(new Date("2026-09-15T10:00:00.000Z"), 30),
        getConsultationInterval(new Date("2026-09-15T10:30:00.000Z"), 15)
      )
    ).toBe(false);
  });

  it("detects an overlap across midnight", () => {
    expect(
      doesConsultationTimeOverlap({
        candidateScheduledAt: new Date("2026-09-16T00:05:00.000Z"),
        candidateDurationMinutes: 15,
        existingScheduledAt: new Date("2026-09-15T23:45:00.000Z"),
        existingDurationMinutes: 30
      })
    ).toBe(true);
  });

  it("serializes writers on the doctor row", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id: "doctor-1" }]) };
    await lockDoctorConsultationSchedule(tx as never, "doctor-1");
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });

  it("fails closed for an active orphan lock using the legacy duration fallback", async () => {
    const tx = {
      consultation: { findMany: vi.fn().mockResolvedValue([]) },
      consultationSlotLock: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "lock-1",
            scheduledAt: new Date("2026-09-15T10:00:00.000Z"),
            availabilityId: null,
            consultation: null
          }
        ])
      },
      doctorAvailability: { findMany: vi.fn() },
      doctorAvailabilityDateOverride: { findMany: vi.fn() }
    };

    await expect(
      findActiveConsultationIntervalConflict(tx as never, {
        doctorId: "doctor-1",
        scheduledAt: new Date("2026-09-15T10:15:00.000Z"),
        durationMinutes: 15,
        now: new Date("2026-09-15T09:00:00.000Z")
      })
    ).resolves.toEqual({ kind: "slot_lock", id: "lock-1" });
  });
});
