import { describe, expect, it, vi } from "vitest";
import {
  assertConsultationReadyForPrescription,
  getDoctorPrescriptionWritePlan,
  issueDoctorPrescription,
  type DoctorPrescriptionConsultation
} from "@/features/prescriptions/service";

function consultation(
  overrides: Partial<DoctorPrescriptionConsultation> = {}
): DoctorPrescriptionConsultation {
  return {
    id: "consultation-1",
    patientId: "patient-1",
    doctorId: "doctor-1",
    status: "scheduled",
    prescriptionOutcomeStatus: "pending_doctor_summary",
    doctor: {
      userId: "doctor-user-1"
    },
    prescriptions: [],
    ...overrides
  };
}

describe("doctor prescription service", () => {
  it.each(["scheduled", "live", "completed"] as const)("allows prescriptions for %s consultations", (status) => {
    expect(() => assertConsultationReadyForPrescription(status)).not.toThrow();
  });

  it.each(["requested", "pending_payment", "cancelled"] as const)("blocks prescriptions for %s consultations", (status) => {
    expect(() => assertConsultationReadyForPrescription(status)).toThrow("Consultation is not ready for prescription writing.");
  });

  it("creates a prescription when no prescription exists yet", () => {
    expect(
      getDoctorPrescriptionWritePlan(consultation(), {
        role: "doctor",
        userId: "doctor-user-1"
      })
    ).toEqual({
      mode: "create"
    });
  });

  it.each(["draft", "rejected"] as const)("updates the latest %s prescription", (status) => {
    expect(
      getDoctorPrescriptionWritePlan(
        consultation({
          prescriptions: [
            {
              id: "prescription-1",
              status
            }
          ]
        }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        }
      )
    ).toEqual({
      mode: "update",
      prescriptionId: "prescription-1",
      previousStatus: status
    });
  });

  it.each(["pending_verification", "verified", "dispensed", "archived"] as const)("blocks a second active %s prescription", (status) => {
    expect(() =>
      getDoctorPrescriptionWritePlan(
        consultation({
          prescriptions: [
            {
              id: "prescription-1",
              status
            }
          ]
        }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        }
      )
    ).toThrow("Consultation already has an active prescription.");
  });

  it("blocks doctors from issuing prescriptions for another doctor's consultation", () => {
    expect(() =>
      getDoctorPrescriptionWritePlan(consultation(), {
        role: "doctor",
        userId: "other-doctor-user"
      })
    ).toThrow("Doctor cannot update another doctor's consultation.");
  });

  it("blocks issuing a prescription after the assigned doctor explicitly recorded no prescription", () => {
    expect(() =>
      getDoctorPrescriptionWritePlan(
        consultation({
          prescriptionOutcomeStatus: "no_prescription"
        }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        }
      )
    ).toThrow("Consultation is explicitly marked as having no prescription.");
  });

  it("allows admins to support prescription issuing without doctor ownership", () => {
    expect(
      getDoctorPrescriptionWritePlan(consultation(), {
        role: "admin",
        userId: "admin-user-1"
      })
    ).toEqual({
      mode: "create"
    });
  });

  it("atomically marks the consultation as prescription issued only after creating a real prescription", async () => {
    const tx = {
      consultation: {
        findUnique: vi.fn().mockResolvedValue(consultation({ status: "completed" })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      prescription: {
        create: vi.fn().mockResolvedValue({ id: "prescription-created" })
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: "notification-1" })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" })
      }
    };

    await issueDoctorPrescription(tx as never, {
      consultationId: "consultation-1",
      notes: "",
      medications: [
        {
          productId: "product-1",
          medicationName: "Medicine",
          dosage: "1 tablet",
          quantity: "1",
          instructions: "Use as directed"
        }
      ],
      actorId: "doctor-user-1",
      actorRole: "doctor"
    });

    expect(tx.prescription.create).toHaveBeenCalled();
    expect(tx.consultation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "consultation-1",
        prescriptionOutcomeStatus: {
          not: "no_prescription"
        }
      },
      data: {
        prescriptionOutcomeStatus: "prescription_issued",
        prescriptionOutcomeUpdatedAt: expect.any(Date)
      }
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "consultation.prescription_outcome_updated",
        metadataJson: {
          previousStatus: "pending_doctor_summary",
          nextStatus: "prescription_issued",
          source: "doctor_prescription_issued"
        }
      })
    });
  });
});
