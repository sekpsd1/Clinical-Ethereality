import { describe, expect, it } from "vitest";
import {
  assertConsultationReadyForPrescription,
  getDoctorPrescriptionWritePlan,
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
});
