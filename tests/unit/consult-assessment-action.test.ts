import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assessmentCreate: vi.fn(),
  hasPermission: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requireCurrentSession: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn()
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({ requireCurrentSession: mocks.requireCurrentSession }));
vi.mock("@/lib/permissions", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { submitConsultAssessmentAction } from "@/features/consultations/assessment/actions";

describe("consult assessment action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentSession.mockResolvedValue({ userId: "customer-1", role: "customer" });
    mocks.hasPermission.mockReturnValue(true);
    mocks.assessmentCreate.mockResolvedValue({ id: "assessment-1" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({ consultAssessment: { create: mocks.assessmentCreate } })
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
          }
        })
      }),
      select: { id: true }
    });
    expect(mocks.redirect).toHaveBeenLastCalledWith("/consult/assessment/complete?assessment=assessment-1");
  });
});
