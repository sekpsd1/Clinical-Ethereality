import { describe, expect, it } from "vitest";
import {
  getAttendanceStatusCopy,
  getConsultationAttendanceState,
  type ConsultationAttendanceEventRecord
} from "@/features/consultations/attendance/state";

const scheduledAt = new Date("2030-01-01T10:00:00.000Z");

function event(
  role: "doctor" | "customer",
  eventType: "joined" | "left",
  occurredAt: string,
  participantSessionHash = `${role}-session`,
  meetingUuidHash = "meeting-a"
): ConsultationAttendanceEventRecord {
  return { role, eventType, occurredAt: new Date(occurredAt), participantSessionHash, meetingUuidHash };
}

describe("consultation Zoom attendance state", () => {
  it("rejects a 15-minute slot at 14:59", () => {
    const state = getConsultationAttendanceState(
      [event("doctor", "joined", "2030-01-01T10:00:00.000Z")], scheduledAt, 15,
      new Date("2030-01-01T10:14:59.000Z")
    );

    expect(state.verifiedDoctorPresenceSeconds).toBe(899);
    expect(state.noShowCompletionEligible).toBe(false);
    expect(state.noShowRemainingSeconds).toBe(1);
  });

  it("accepts a 15-minute slot exactly at 15:00 while the verified interval is active", () => {
    const state = getConsultationAttendanceState(
      [event("doctor", "joined", "2030-01-01T10:00:00.000Z")], scheduledAt, 15,
      new Date("2030-01-01T10:15:00.000Z")
    );

    expect(state.verifiedDoctorPresenceSeconds).toBe(900);
    expect(state.noShowCompletionEligible).toBe(true);
  });

  it("does not count an early T-5 join before the scheduled time", () => {
    const state = getConsultationAttendanceState(
      [event("doctor", "joined", "2030-01-01T09:55:00.000Z")], scheduledAt, 15,
      new Date("2030-01-01T10:14:59.000Z")
    );

    expect(state.activeDoctorPresenceSeconds).toBe(899);
    expect(state.noShowCompletionEligible).toBe(false);
  });

  it("requires a late-joining doctor to remain for the full booked duration", () => {
    const events = [event("doctor", "joined", "2030-01-01T10:07:00.000Z")];
    const early = getConsultationAttendanceState(events, scheduledAt, 15, new Date("2030-01-01T10:21:59.000Z"));
    const eligible = getConsultationAttendanceState(events, scheduledAt, 15, new Date("2030-01-01T10:22:00.000Z"));

    expect(early.noShowCompletionEligible).toBe(false);
    expect(eligible.noShowCompletionEligible).toBe(true);
  });

  it("does not accumulate disconnected intervals after rejoin", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z", "session-one"),
        event("doctor", "left", "2030-01-01T10:10:00.000Z", "session-one"),
        event("doctor", "joined", "2030-01-01T10:11:00.000Z", "session-two")
      ], scheduledAt, 15, new Date("2030-01-01T10:16:00.000Z")
    );

    expect(state.longestVerifiedDoctorPresenceSeconds).toBe(600);
    expect(state.activeDoctorPresenceSeconds).toBe(300);
    expect(state.verifiedDoctorPresenceSeconds).toBe(600);
    expect(state.noShowRemainingSeconds).toBe(600);
    expect(state.noShowCompletionEligible).toBe(false);
  });

  it("does not allow normal completion while both participants are still in the room", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("customer", "joined", "2030-01-01T10:01:00.000Z")
      ], scheduledAt, 15, new Date("2030-01-01T10:14:59.000Z")
    );

    expect(state.bothJoinedSameMeeting).toBe(true);
    expect(state.doctorCurrentlyPresent).toBe(true);
    expect(state.customerCurrentlyPresent).toBe(true);
    expect(state.allParticipantsHaveLeft).toBe(false);
    expect(state.normalCompletionEligible).toBe(false);
  });

  it("allows normal completion after same-meeting overlap and both leave before 15 minutes", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("customer", "joined", "2030-01-01T10:01:00.000Z"),
        event("customer", "left", "2030-01-01T10:03:00.000Z"),
        event("doctor", "left", "2030-01-01T10:04:00.000Z")
      ], scheduledAt, 15, new Date("2030-01-01T10:05:00.000Z")
    );

    expect(state.bothJoinedSameMeeting).toBe(true);
    expect(state.allParticipantsHaveLeft).toBe(true);
    expect(state.verifiedDoctorPresenceSeconds).toBe(240);
    expect(state.normalCompletionEligible).toBe(true);
    expect(state.noShowCompletionEligible).toBe(false);
  });

  it.each([
    ["doctor", [
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("customer", "joined", "2030-01-01T10:01:00.000Z"),
      event("customer", "left", "2030-01-01T10:03:00.000Z")
    ]],
    ["customer", [
      event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
      event("customer", "joined", "2030-01-01T10:01:00.000Z"),
      event("doctor", "left", "2030-01-01T10:03:00.000Z")
    ]]
  ] as const)("keeps normal completion blocked while the %s remains in the room", (_role, events) => {
    const state = getConsultationAttendanceState(
      [...events], scheduledAt, 15, new Date("2030-01-01T10:04:00.000Z")
    );

    expect(state.bothJoinedSameMeeting).toBe(true);
    expect(state.allParticipantsHaveLeft).toBe(false);
    expect(state.normalCompletionEligible).toBe(false);
  });

  it("fails closed when a leave event does not match the active participant session", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z", "doctor-session"),
        event("customer", "joined", "2030-01-01T10:01:00.000Z", "customer-session"),
        event("customer", "left", "2030-01-01T10:02:00.000Z", "customer-session"),
        event("doctor", "left", "2030-01-01T10:03:00.000Z", "different-doctor-session")
      ], scheduledAt, 15, new Date("2030-01-01T10:04:00.000Z")
    );

    expect(state.bothJoinedSameMeeting).toBe(true);
    expect(state.doctorCurrentlyPresent).toBe(true);
    expect(state.allParticipantsHaveLeft).toBe(false);
    expect(state.normalCompletionEligible).toBe(false);
  });

  it("allows no-show after the full booked duration when the customer never joined", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("doctor", "left", "2030-01-01T10:15:00.000Z")
      ], scheduledAt, 15, new Date("2030-01-01T10:16:00.000Z")
    );

    expect(state.noShowCompletionEligible).toBe(true);
    expect(state.normalCompletionEligible).toBe(false);
  });

  it.each([30, 45, 60])("uses a stored %i-minute booked duration", (durationMinutes) => {
    const events = [event("doctor", "joined", "2030-01-01T10:00:00.000Z")];
    const before = getConsultationAttendanceState(
      events, scheduledAt, durationMinutes,
      new Date(scheduledAt.getTime() + durationMinutes * 60_000 - 1_000)
    );
    const exact = getConsultationAttendanceState(
      events, scheduledAt, durationMinutes,
      new Date(scheduledAt.getTime() + durationMinutes * 60_000)
    );

    expect(before.noShowCompletionEligible).toBe(false);
    expect(exact.requiredDurationMinutes).toBe(durationMinutes);
    expect(exact.noShowCompletionEligible).toBe(true);
  });

  it.each([null, undefined, 0, 20, Number.NaN])(
    "falls back to 30 minutes for a missing or invalid duration (%s)",
    (durationMinutes) => {
      const state = getConsultationAttendanceState(
        [event("doctor", "joined", "2030-01-01T10:00:00.000Z")], scheduledAt,
        durationMinutes, new Date("2030-01-01T10:30:00.000Z")
      );

      expect(state.requiredDurationMinutes).toBe(30);
      expect(state.noShowCompletionEligible).toBe(true);
    }
  );

  it("requires positive temporal overlap in the same meeting", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("doctor", "left", "2030-01-01T10:15:00.000Z"),
        event("customer", "joined", "2030-01-01T10:15:00.000Z"),
        event("customer", "left", "2030-01-01T10:16:00.000Z")
      ], scheduledAt, 15, new Date("2030-01-01T10:16:00.000Z")
    );

    expect(state.bothJoinedSameMeeting).toBe(false);
    expect(state.normalCompletionEligible).toBe(false);
  });

  it("permanently disables no-show after any verified customer join", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("customer", "joined", "2030-01-01T10:16:00.000Z", "customer-one", "meeting-b")
      ], scheduledAt, 15, new Date("2030-01-01T10:20:00.000Z")
    );

    expect(state.customerEverJoined).toBe(true);
    expect(state.noShowCompletionEligible).toBe(false);
  });

  it("asks both participants to leave after verified overlap instead of restarting a timer", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("customer", "joined", "2030-01-01T10:01:00.000Z")
      ], scheduledAt, 15, new Date("2030-01-01T10:14:59.000Z")
    );

    expect(getAttendanceStatusCopy(state, "doctor")).toMatchObject({
      label: "Zoom ยืนยันผู้เข้าร่วมครบแล้ว • รอออกจากห้อง",
      description: expect.stringContaining("ออกจากห้อง Zoom ให้ครบ")
    });
    expect(getAttendanceStatusCopy(state, "doctor").description).not.toContain("15 นาที");
  });

  it("provides the booked-duration no-show countdown and eligible copy", () => {
    const waiting = getConsultationAttendanceState(
      [event("doctor", "joined", "2030-01-01T10:00:00.000Z")], scheduledAt, 15,
      new Date("2030-01-01T10:14:59.000Z")
    );
    const eligible = getConsultationAttendanceState(
      [event("doctor", "joined", "2030-01-01T10:00:00.000Z")], scheduledAt, 15,
      new Date("2030-01-01T10:15:00.000Z")
    );

    expect(getAttendanceStatusCopy(waiting, "doctor").description).toContain("1 วินาที");
    expect(getAttendanceStatusCopy(eligible, "doctor").label).toBe("ยืนยันเวลารอครบ 15 นาทีแล้ว");
  });
});
