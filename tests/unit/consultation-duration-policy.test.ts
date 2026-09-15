import { describe, expect, it } from "vitest";
import {
  CONSULTATION_DURATION_OPTIONS,
  getBookedConsultationDurationMinutes,
  getNewScheduleDurationMinutes,
  LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES,
  NEW_CONSULTATION_DURATION_MINUTES
} from "@/features/consultations/duration-policy";

describe("consultation duration policy", () => {
  it("exposes only the fixed 15-minute duration for new consultation schedules", () => {
    expect(NEW_CONSULTATION_DURATION_MINUTES).toBe(15);
    expect(getNewScheduleDurationMinutes()).toBe(15);
    expect(CONSULTATION_DURATION_OPTIONS).toEqual([15]);
  });

  it.each([15, 30, 45, 60, 20, null, undefined])(
    "canonicalizes persisted schedule duration %s to 15 minutes for future slots",
    (durationMinutes) => {
      expect(getNewScheduleDurationMinutes(durationMinutes)).toBe(15);
    }
  );

  it("preserves valid historical booked durations for read and attendance behavior", () => {
    expect(getBookedConsultationDurationMinutes(15)).toBe(15);
    expect(getBookedConsultationDurationMinutes(30)).toBe(30);
    expect(getBookedConsultationDurationMinutes(45)).toBe(45);
    expect(getBookedConsultationDurationMinutes(60)).toBe(60);
  });

  it("uses the explicit legacy fallback only when a historical booked duration is missing or invalid", () => {
    expect(LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES).toBe(30);
    expect(getBookedConsultationDurationMinutes(null)).toBe(30);
    expect(getBookedConsultationDurationMinutes(0)).toBe(30);
    expect(getBookedConsultationDurationMinutes(20)).toBe(30);
  });
});
