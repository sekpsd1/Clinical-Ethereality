import { describe, expect, it } from "vitest";
import {
  CONSULTATION_DURATION_OPTIONS,
  getBookedConsultationDurationMinutes,
  getNewScheduleDurationMinutes,
  LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES,
  NEW_CONSULTATION_DURATION_MINUTES
} from "@/features/consultations/duration-policy";

describe("consultation duration policy", () => {
  it("defaults every new schedule surface to 15 minutes while preserving explicit choices", () => {
    expect(NEW_CONSULTATION_DURATION_MINUTES).toBe(15);
    expect(getNewScheduleDurationMinutes()).toBe(15);
    expect(CONSULTATION_DURATION_OPTIONS).toEqual([15, 30, 45, 60]);
  });

  it("preserves an existing 30-minute schedule instead of applying the new default", () => {
    expect(getNewScheduleDurationMinutes(30)).toBe(30);
  });

  it("uses the explicit legacy fallback only when a booked duration is missing or invalid", () => {
    expect(LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES).toBe(30);
    expect(getBookedConsultationDurationMinutes(15)).toBe(15);
    expect(getBookedConsultationDurationMinutes(30)).toBe(30);
    expect(getBookedConsultationDurationMinutes(null)).toBe(30);
    expect(getBookedConsultationDurationMinutes(0)).toBe(30);
  });
});
