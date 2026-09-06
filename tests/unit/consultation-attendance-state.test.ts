import { describe, expect, it } from "vitest";
import {
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
  return {
    role,
    eventType,
    occurredAt: new Date(occurredAt),
    participantSessionHash,
    meetingUuidHash
  };
}

describe("consultation Zoom attendance state", () => {
  it("allows normal completion only while both roles overlap in the same meeting", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("customer", "joined", "2030-01-01T10:02:00.000Z")
      ],
      scheduledAt,
      new Date("2030-01-01T10:03:00.000Z")
    );

    expect(state.normalCompletionEligible).toBe(true);
    expect(state.bothJoinedSameMeeting).toBe(true);
  });

  it("does not qualify sequential attendance with no positive temporal overlap", () => {
    const state = getConsultationAttendanceState(
      [
        event("customer", "joined", "2030-01-01T10:06:00.000Z"),
        event("doctor", "left", "2030-01-01T10:05:00.000Z"),
        event("customer", "left", "2030-01-01T10:08:00.000Z"),
        event("doctor", "joined", "2030-01-01T10:00:00.000Z")
      ],
      scheduledAt,
      new Date("2030-01-01T10:09:00.000Z")
    );

    expect(state.doctorEverJoined).toBe(true);
    expect(state.customerEverJoined).toBe(true);
    expect(state.bothJoinedSameMeeting).toBe(false);
    expect(state.normalCompletionEligible).toBe(false);
  });

  it("qualifies a verified positive overlap from out-of-order closed events", () => {
    const state = getConsultationAttendanceState(
      [
        event("customer", "left", "2030-01-01T10:08:00.000Z"),
        event("doctor", "left", "2030-01-01T10:05:00.000Z"),
        event("customer", "joined", "2030-01-01T10:04:00.000Z"),
        event("doctor", "joined", "2030-01-01T10:00:00.000Z")
      ],
      scheduledAt,
      new Date("2030-01-01T10:09:00.000Z")
    );

    expect(state.bothJoinedSameMeeting).toBe(true);
    expect(state.normalCompletionEligible).toBe(true);
  });

  it("requires positive overlap rather than matching boundary timestamps", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("doctor", "left", "2030-01-01T10:05:00.000Z"),
        event("customer", "joined", "2030-01-01T10:05:00.000Z"),
        event("customer", "left", "2030-01-01T10:06:00.000Z")
      ],
      scheduledAt,
      new Date("2030-01-01T10:07:00.000Z")
    );

    expect(state.normalCompletionEligible).toBe(false);
  });

  it("does not combine attendance from different meeting UUIDs", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z", "doctor-session", "meeting-a"),
        event("customer", "joined", "2030-01-01T10:02:00.000Z", "customer-session", "meeting-b")
      ],
      scheduledAt
    );

    expect(state.normalCompletionEligible).toBe(false);
  });

  it("denies no-show before a completed ten-minute continuous doctor interval", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("doctor", "left", "2030-01-01T10:09:59.000Z")
      ],
      scheduledAt
    );

    expect(state.longestVerifiedDoctorPresenceSeconds).toBe(599);
    expect(state.noShowCompletionEligible).toBe(false);
  });

  it("allows no-show after Zoom closes a continuous doctor interval of ten minutes", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T09:58:00.000Z"),
        event("doctor", "left", "2030-01-01T10:10:00.000Z")
      ],
      scheduledAt
    );

    expect(state.longestVerifiedDoctorPresenceSeconds).toBe(600);
    expect(state.noShowCompletionEligible).toBe(true);
  });

  it("resets the continuous wait after a short interval and handles out-of-order delivery", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "left", "2030-01-01T10:05:00.000Z", "session-one"),
        event("doctor", "joined", "2030-01-01T10:06:00.000Z", "session-two"),
        event("doctor", "joined", "2030-01-01T10:00:00.000Z", "session-one"),
        event("doctor", "left", "2030-01-01T10:16:00.000Z", "session-two")
      ],
      scheduledAt
    );

    expect(state.longestVerifiedDoctorPresenceSeconds).toBe(600);
    expect(state.noShowCompletionEligible).toBe(true);
  });

  it("permanently disables no-show once customer join evidence exists", () => {
    const state = getConsultationAttendanceState(
      [
        event("doctor", "joined", "2030-01-01T10:00:00.000Z"),
        event("doctor", "left", "2030-01-01T10:10:00.000Z"),
        event("customer", "joined", "2030-01-01T10:11:00.000Z")
      ],
      scheduledAt
    );

    expect(state.customerEverJoined).toBe(true);
    expect(state.noShowCompletionEligible).toBe(false);
  });

  it("shows the active countdown but fails closed until a leave event proves the interval", () => {
    const state = getConsultationAttendanceState(
      [event("doctor", "joined", "2030-01-01T10:00:00.000Z")],
      scheduledAt,
      new Date("2030-01-01T10:10:00.000Z")
    );

    expect(state.activeDoctorPresenceSeconds).toBe(600);
    expect(state.noShowRemainingSeconds).toBe(0);
    expect(state.noShowCompletionEligible).toBe(false);
  });
});
