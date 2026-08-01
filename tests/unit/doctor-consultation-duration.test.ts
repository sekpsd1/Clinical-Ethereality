import { describe, expect, it } from "vitest";
import {
  formatDoctorConsultationDuration,
  getLegacyDurationAvailabilityIds,
  resolveDoctorConsultationDurationSnapshots,
  type ConsultationBookingDurationAudit,
  type ConsultationDurationAvailability
} from "@/features/doctor/consultations/duration";

function audit(overrides: Partial<ConsultationBookingDurationAudit> = {}): ConsultationBookingDurationAudit {
  return {
    id: "audit-1",
    entityId: "consultation-1",
    createdAt: new Date("2026-08-01T02:00:00.000Z"),
    metadataJson: {
      availabilityId: "availability-1"
    },
    ...overrides
  };
}

function availability(overrides: Partial<ConsultationDurationAvailability> = {}): ConsultationDurationAvailability {
  return {
    id: "availability-1",
    slotMinutes: 60,
    updatedAt: new Date("2026-08-01T01:00:00.000Z"),
    ...overrides
  };
}

describe("doctor consultation duration", () => {
  it.each([15, 30, 45, 60])("uses the configured %i-minute availability slot", (slotMinutes) => {
    expect(formatDoctorConsultationDuration(slotMinutes)).toBe(`${slotMinutes} นาที`);
  });

  it.each([null, undefined, 0, -15, 22.5])("keeps incomplete or invalid availability duration explicit", (slotMinutes) => {
    expect(formatDoctorConsultationDuration(slotMinutes)).toBe("ยังไม่ระบุ");
  });

  it("keeps the new booking snapshot after an expired or cancelled consultation loses its slot lock", () => {
    const durations = resolveDoctorConsultationDurationSnapshots(
      [audit({ metadataJson: { availabilityId: "availability-1", slotMinutes: 60 } })],
      [availability({ slotMinutes: 30, updatedAt: new Date("2026-08-02T01:00:00.000Z") })]
    );

    expect(durations.get("consultation-1")).toBe(60);
  });

  it("recovers legacy duration only when the availability record was unchanged since booking", () => {
    const durations = resolveDoctorConsultationDurationSnapshots([audit()], [availability({ slotMinutes: 45 })]);

    expect(durations.get("consultation-1")).toBe(45);
  });

  it("does not infer legacy duration when the availability changed or is missing", () => {
    const changedAvailability = availability({ updatedAt: new Date("2026-08-01T03:00:00.000Z") });

    expect(resolveDoctorConsultationDurationSnapshots([audit()], [changedAvailability]).has("consultation-1")).toBe(false);
    expect(resolveDoctorConsultationDurationSnapshots([audit()], []).has("consultation-1")).toBe(false);
  });

  it("handles malformed metadata and resolves multiple booking audits deterministically", () => {
    const audits = [
      audit({ id: "audit-b", createdAt: new Date("2026-08-01T02:00:00.000Z"), metadataJson: "invalid" }),
      audit({ id: "audit-c", createdAt: new Date("2026-08-01T03:00:00.000Z"), metadataJson: { slotMinutes: 45 } }),
      audit({ id: "audit-a", createdAt: new Date("2026-08-01T03:00:00.000Z"), metadataJson: { slotMinutes: 30 } })
    ];

    const durations = resolveDoctorConsultationDurationSnapshots(audits, []);

    expect(durations.get("consultation-1")).toBe(30);
    expect(getLegacyDurationAvailabilityIds([...audits, audit({ id: "audit-d", metadataJson: { availabilityId: 123 } })])).toEqual([]);
  });
});
