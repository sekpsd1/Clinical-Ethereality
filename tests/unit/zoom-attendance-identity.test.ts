import { describe, expect, it } from "vitest";
import {
  createZoomAttendanceCredential,
  getZoomAttendanceEventHashes,
  hashZoomAttendanceValue
} from "@/features/consultations/attendance/identity";

describe("Zoom attendance identity", () => {
  it("issues role-marked opaque customer keys and stores only their hash", () => {
    const credential = createZoomAttendanceCredential("doctor", new Date("2030-01-01T10:00:00.000Z"));

    expect(credential.customerKey).toMatch(/^d[A-Za-z0-9]{32}$/);
    expect(credential.customerKey.length).toBeLessThanOrEqual(36);
    expect(credential.customerKeyHash).toBe(hashZoomAttendanceValue("customer-key", credential.customerKey));
    expect(credential.customerKeyHash).not.toContain(credential.customerKey);
    expect(credential.expiresAt.toISOString()).toBe("2030-01-01T12:00:00.000Z");
  });

  it("builds stable nonreversible event and session identifiers", () => {
    const input = {
      eventType: "joined" as const,
      meetingId: "12345678901",
      meetingUuid: "raw-meeting-uuid",
      participantUserId: "raw-participant-id",
      customerKey: "d0123456789abcdef0123456789abcdef",
      occurredAt: new Date("2030-01-01T10:00:00.000Z")
    };
    const first = getZoomAttendanceEventHashes(input);
    const second = getZoomAttendanceEventHashes(input);

    expect(first).toEqual(second);
    expect(Object.values(first).every((value) => /^[a-f0-9]{64}$/.test(value))).toBe(true);
    expect(JSON.stringify(first)).not.toContain("raw-");
  });
});
