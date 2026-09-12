import { describe, expect, it } from "vitest";
import {
  CONSULT_ASSESSMENT_VALIDITY_MS,
  getActiveConsultAssessmentWhere,
  getConsultAssessmentExpiresAt,
  isConsultAssessmentActive
} from "@/features/consultations/assessment/validity";

describe("consult assessment 24-hour validity", () => {
  const now = new Date("2026-09-12T10:00:00.000Z");

  it("sets a new assessment expiry to exactly 24 hours after completion", () => {
    expect(getConsultAssessmentExpiresAt(now).getTime() - now.getTime()).toBe(CONSULT_ASSESSMENT_VALIDITY_MS);
  });

  it("caps legacy seven-day records at 24 hours using completedAt", () => {
    expect(
      isConsultAssessmentActive(
        {
          completedAt: new Date("2026-09-11T10:00:01.000Z"),
          expiresAt: new Date("2026-09-19T10:00:00.000Z")
        },
        now
      )
    ).toBe(true);

    expect(
      isConsultAssessmentActive(
        {
          completedAt: new Date("2026-09-11T10:00:00.000Z"),
          expiresAt: new Date("2026-09-19T10:00:00.000Z")
        },
        now
      )
    ).toBe(false);
  });

  it("builds the same database boundary for every active-assessment lookup", () => {
    expect(getActiveConsultAssessmentWhere("customer-1", now)).toEqual({
      userId: "customer-1",
      completedAt: { gt: new Date("2026-09-11T10:00:00.000Z") },
      expiresAt: { gt: now }
    });
  });
});
