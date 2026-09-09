import { describe, expect, it } from "vitest";
import {
  getDoctorConsultationNextStatus,
  type DoctorConsultationWorkflowSnapshot
} from "@/features/doctor/consultations/workflow-service";

function consultation(
  overrides: Partial<DoctorConsultationWorkflowSnapshot> = {}
): DoctorConsultationWorkflowSnapshot {
  return {
    id: "consultation-1",
    patientId: "patient-1",
    status: "scheduled",
    scheduledAt: new Date("2020-01-01T10:00:00.000Z"),
    doctor: {
      userId: "doctor-user-1"
    },
    ...overrides
  };
}

describe("doctor consultation workflow", () => {
  it("starts only an assigned scheduled consultation", () => {
    expect(
      getDoctorConsultationNextStatus(
        consultation(),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "start"
      )
    ).toBe("live");
  });

  it("rejects starting immediately before the five-minute preparation window", () => {
    expect(() =>
      getDoctorConsultationNextStatus(
        consultation({
          scheduledAt: new Date("2030-01-01T10:00:00.000Z")
        }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "start",
        new Date("2030-01-01T09:54:59.999Z")
      )
    ).toThrow("Consultation cannot start before the five-minute preparation window.");
  });

  it("allows starting exactly five minutes before the appointment", () => {
    const scheduledAt = new Date("2030-01-01T10:00:00.000Z");

    expect(
      getDoctorConsultationNextStatus(
        consultation({ scheduledAt }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "start",
        new Date("2030-01-01T09:55:00.000Z")
      )
    ).toBe("live");
  });

  it("allows starting after the scheduled appointment time", () => {
    const scheduledAt = new Date("2030-01-01T10:00:00.000Z");

    expect(
      getDoctorConsultationNextStatus(
        consultation({ scheduledAt }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "start",
        new Date("2030-01-01T10:30:00.000Z")
      )
    ).toBe("live");
  });

  it("fails closed when a scheduled consultation has no appointment time", () => {
    expect(() =>
      getDoctorConsultationNextStatus(
        consultation({ scheduledAt: null }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "start"
      )
    ).toThrow("Consultation appointment time is required before starting.");
  });

  it("completes only an assigned live consultation", () => {
    expect(
      getDoctorConsultationNextStatus(
        consultation({
          status: "live"
        }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "complete"
      )
    ).toBe("completed");
  });

  it("blocks doctors from changing another doctor's consultation", () => {
    expect(() =>
      getDoctorConsultationNextStatus(
        consultation(),
        {
          role: "doctor",
          userId: "doctor-user-2"
        },
        "start"
      )
    ).toThrow("Doctor cannot update another doctor's consultation.");
  });

  it("blocks invalid workflow transitions", () => {
    expect(() =>
      getDoctorConsultationNextStatus(
        consultation({
          status: "pending_payment"
        }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "start"
      )
    ).toThrow("Only scheduled consultations can be started.");

    expect(() =>
      getDoctorConsultationNextStatus(
        consultation({
          status: "completed"
        }),
        {
          role: "doctor",
          userId: "doctor-user-1"
        },
        "complete"
      )
    ).toThrow("Only live consultations can be completed.");
  });

  it("allows admins to support the transition without doctor ownership", () => {
    expect(
      getDoctorConsultationNextStatus(
        consultation(),
        {
          role: "admin",
          userId: "admin-user-1"
        },
        "start"
      )
    ).toBe("live");
  });
});
