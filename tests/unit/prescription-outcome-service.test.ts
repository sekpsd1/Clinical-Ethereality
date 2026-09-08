import { describe, expect, it, vi } from "vitest";
import type { ConsultationPrescriptionOutcomeRecord } from "@/features/prescriptions/outcome";
import {
  ConsultationPrescriptionOutcomeError,
  assertConsultationPrescriptionOutcomeTransition,
  setConsultationPrescriptionOutcome
} from "@/features/prescriptions/outcome";

function consultation(
  overrides: Partial<ConsultationPrescriptionOutcomeRecord> = {}
): ConsultationPrescriptionOutcomeRecord {
  return {
    id: "consultation-1",
    status: "completed",
    prescriptionOutcomeStatus: "pending_doctor_summary",
    doctor: {
      userId: "doctor-user-1"
    },
    prescriptions: [],
    ...overrides
  };
}

function expectOutcomeError(operation: () => void, code: ConsultationPrescriptionOutcomeError["code"]) {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(ConsultationPrescriptionOutcomeError);
    expect((error as ConsultationPrescriptionOutcomeError).code).toBe(code);
    return;
  }

  throw new Error(`Expected ${code}`);
}

describe("consultation prescription outcome", () => {
  it("allows the assigned doctor to explicitly record no prescription after completion", () => {
    expect(() =>
      assertConsultationPrescriptionOutcomeTransition(consultation(), "no_prescription", {
        role: "doctor",
        userId: "doctor-user-1"
      })
    ).not.toThrow();
  });

  it.each([
    ["doctor", "other-doctor-user"],
    ["customer", "customer-user-1"],
    ["admin", "admin-user-1"]
  ] as const)("rejects unauthorized %s outcome mutation", (role, userId) => {
    expectOutcomeError(
      () =>
        assertConsultationPrescriptionOutcomeTransition(consultation(), "no_prescription", {
          role,
          userId
        }),
      "forbidden"
    );
  });

  it.each(["requested", "pending_payment", "reschedule_required", "scheduled", "live", "cancelled"] as const)(
    "rejects outcome mutation while consultation is %s",
    (status) => {
      expectOutcomeError(
        () =>
          assertConsultationPrescriptionOutcomeTransition(
            consultation({ status }),
            "no_prescription",
            { role: "doctor", userId: "doctor-user-1" }
          ),
        "invalid_lifecycle"
      );
    }
  );

  it("rejects no prescription when a real active prescription exists", () => {
    expectOutcomeError(
      () =>
        assertConsultationPrescriptionOutcomeTransition(
          consultation({ prescriptions: [{ id: "prescription-1", status: "verified" }] }),
          "no_prescription",
          { role: "doctor", userId: "doctor-user-1" }
        ),
      "active_prescription_conflict"
    );
  });

  it("rejects prescription issued when there is no real active prescription", () => {
    expectOutcomeError(
      () =>
        assertConsultationPrescriptionOutcomeTransition(consultation(), "prescription_issued", {
          role: "doctor",
          userId: "doctor-user-1"
        }),
      "missing_active_prescription"
    );
  });

  it.each(["pending_verification", "verified", "dispensed", "archived"] as const)(
    "accepts prescription issued when a real %s prescription exists",
    (status) => {
      expect(() =>
        assertConsultationPrescriptionOutcomeTransition(
          consultation({ prescriptions: [{ id: "prescription-1", status }] }),
          "prescription_issued",
          { role: "doctor", userId: "doctor-user-1" }
        )
      ).not.toThrow();
    }
  );

  it("allows an auditable correction from no prescription back to pending", () => {
    expect(() =>
      assertConsultationPrescriptionOutcomeTransition(
        consultation({ prescriptionOutcomeStatus: "no_prescription" }),
        "pending_doctor_summary",
        { role: "doctor", userId: "doctor-user-1" }
      )
    ).not.toThrow();
  });

  it("persists the explicit outcome with compare-and-swap and generic audit metadata", async () => {
    const tx = {
      consultation: {
        findUnique: vi.fn().mockResolvedValue(consultation()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" })
      }
    };

    await setConsultationPrescriptionOutcome(tx as never, {
      consultationId: "consultation-1",
      nextStatus: "no_prescription",
      actorId: "doctor-user-1",
      actorRole: "doctor"
    });

    expect(tx.consultation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "consultation-1",
          status: "completed",
          prescriptionOutcomeStatus: "pending_doctor_summary",
          prescriptions: {
            none: expect.any(Object)
          }
        }),
        data: expect.objectContaining({
          prescriptionOutcomeStatus: "no_prescription"
        })
      })
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "doctor-user-1",
        action: "consultation.prescription_outcome_updated",
        entityType: "consultation",
        entityId: "consultation-1",
        metadataJson: {
          previousStatus: "pending_doctor_summary",
          nextStatus: "no_prescription"
        }
      })
    });
  });
});
