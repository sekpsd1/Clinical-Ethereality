import { describe, expect, it } from "vitest";
import { buildAdminAppointmentCalendarSlots } from "@/features/admin/schedules/appointment-calendar";

describe("admin appointment calendar", () => {
  it("shows available, confirmed, and active pending-payment slots without exposing an expired hold or patient data", () => {
    const slots = buildAdminAppointmentCalendarSlots({
      dateValue: "2026-09-07",
      now: new Date("2026-09-01T00:00:00.000Z"),
      availabilities: [{ id: "availability-1", doctorId: "doctor-1", weekday: 1, startTime: "09:00", endTime: "11:00", slotMinutes: 30, notes: null }],
      overrides: [],
      consultations: [
        { doctorId: "doctor-1", scheduledAt: new Date("2026-09-07T02:30:00.000Z"), status: "scheduled", slotLockExpiresAt: null },
        { doctorId: "doctor-1", scheduledAt: new Date("2026-09-07T03:00:00.000Z"), status: "pending_payment", slotLockExpiresAt: new Date("2026-09-01T00:15:00.000Z") },
        { doctorId: "doctor-1", scheduledAt: new Date("2026-09-07T03:30:00.000Z"), status: "pending_payment", slotLockExpiresAt: new Date("2026-08-31T23:00:00.000Z") }
      ]
    });

    expect(slots.map((slot) => [slot.timeLabel, slot.consultation?.status ?? null])).toEqual([
      ["09:00", null], ["09:30", "scheduled"], ["10:00", "pending_payment"], ["10:30", null]
    ]);
    expect(slots.every((slot) => slot.availabilityId === "availability-1")).toBe(true);
    expect(slots.flatMap((slot) => slot.consultation ? [slot.consultation] : [])).not.toContainEqual(expect.objectContaining({ patientName: expect.anything() }));
  });

  it("suppresses recurring availability on a closed override date", () => {
    const slots = buildAdminAppointmentCalendarSlots({
      dateValue: "2026-09-07",
      now: new Date("2026-09-01T00:00:00.000Z"),
      availabilities: [{ id: "availability-1", doctorId: "doctor-1", weekday: 1, startTime: "09:00", endTime: "10:00", slotMinutes: 30, notes: null }],
      overrides: [{ id: "closed-1", doctorId: "doctor-1", type: "closed", startTime: null, endTime: null, slotMinutes: null, notes: null }],
      consultations: []
    });

    expect(slots).toEqual([]);
  });
});
