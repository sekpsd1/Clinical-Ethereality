import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assessmentCreate: vi.fn(),
  consentFindUnique: vi.fn(),
  consentUpsert: vi.fn(),
  hasPermission: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireCurrentSession: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/auth/session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    consentRecord: { findUnique: mocks.consentFindUnique },
    $transaction: mocks.transaction
  }
}));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import {
  acceptConsultAssessmentHealthConsentAction,
  submitConsultAssessmentAction
} from "@/features/consultations/assessment/actions";
import { CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION } from "@/features/consultations/assessment/consent";

describe("consult assessment action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.hasPermission.mockReturnValue(true);
    mocks.assessmentCreate.mockResolvedValue({ id: "assessment-1" });
    mocks.consentFindUnique.mockResolvedValue({ id: "consent-1", revokedAt: null });
    mocks.consentUpsert.mockResolvedValue({ id: "consent-1" });
    mocks.headers.mockResolvedValue(new Headers({ "user-agent": "vitest" }));
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        consultAssessment: { create: mocks.assessmentCreate },
        consentRecord: { upsert: mocks.consentUpsert }
      })
    );
  });

  it("persists a trimmed other-symptom detail in the current assessment shape", async () => {
    const formData = new FormData();
    formData.set("symptom", "other");
    formData.set("symptomDetail", "  เจ็บท้องน้อย  ");
    formData.set("duration", "1-3days");

    await submitConsultAssessmentAction(formData);

    expect(mocks.assessmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        symptom: "other",
        symptomLabel: "อื่นๆ: เจ็บท้องน้อย",
        answersJson: expect.objectContaining({
          symptom: {
            value: "other",
            label: "อื่นๆ: เจ็บท้องน้อย",
            detail: "เจ็บท้องน้อย"
          },
          consent: {
            type: "health_data",
            version: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION
          }
        }),
        completedAt: expect.any(Date),
        expiresAt: expect.any(Date)
      }),
      select: { id: true }
    });
    const createInput = mocks.assessmentCreate.mock.calls[0]?.[0];
    expect(createInput.data.expiresAt.getTime() - createInput.data.completedAt.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(mocks.redirect).toHaveBeenLastCalledWith("/consult/assessment/complete?assessment=assessment-1");
  });

  it("records explicit assessment health-data consent before symptom entry", async () => {
    const formData = new FormData();
    formData.set("healthDataConsentAccepted", "on");
    formData.set("version", CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION);

    await acceptConsultAssessmentHealthConsentAction(formData);

    expect(mocks.consentUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_type_version: {
          userId: "customer-1",
          type: "health_data",
          version: CONSULT_ASSESSMENT_HEALTH_CONSENT_VERSION
        }
      },
      update: expect.objectContaining({ revokedAt: null })
    }));
    expect(mocks.redirect).toHaveBeenLastCalledWith("/consult/assessment/symptoms");
  });
});
