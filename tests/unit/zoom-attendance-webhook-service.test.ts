import { describe, expect, it, vi } from "vitest";
import {
  applyZoomParticipantAttendanceEvent,
  ZoomAttendanceWebhookError
} from "@/features/consultations/attendance/webhook-service";
import { hashZoomAttendanceValue } from "@/features/consultations/attendance/identity";

const customerKey = "d0123456789abcdef0123456789abcdef";
const attendanceEvent = {
  eventType: "joined" as const,
  meetingId: "12345678901",
  meetingUuid: "raw-meeting-uuid",
  participantUserId: "raw-participant-id",
  customerKey,
  occurredAt: new Date("2030-01-01T10:00:00.000Z")
};

function transaction(overrides: { meetingId?: string; inserted?: number; credential?: null } = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    consultationAttendanceCredential: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.credential === null
          ? null
          : {
              role: "doctor",
              createdAt: new Date("2030-01-01T09:59:00.000Z"),
              expiresAt: new Date("2030-01-01T12:00:00.000Z"),
              consultation: {
                id: "consultation-1",
                zoomMeetingId: overrides.meetingId ?? "12345678901"
              }
            }
      )
    },
    consultationAttendanceEvent: {
      createMany: vi.fn().mockResolvedValue({ count: overrides.inserted ?? 1 })
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
}

describe("Zoom attendance webhook persistence", () => {
  it("binds the hashed key to the consultation and stores no raw identifiers", async () => {
    const tx = transaction();

    const result = await applyZoomParticipantAttendanceEvent(tx as never, attendanceEvent);

    expect(tx.consultationAttendanceCredential.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerKeyHash: hashZoomAttendanceValue("customer-key", customerKey) }
      })
    );
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    const createInput = tx.consultationAttendanceEvent.createMany.mock.calls[0]?.[0];
    expect(createInput.skipDuplicates).toBe(true);
    expect(JSON.stringify(createInput)).not.toContain(customerKey);
    expect(JSON.stringify(createInput)).not.toContain("raw-meeting-uuid");
    expect(JSON.stringify(createInput)).not.toContain("raw-participant-id");
    expect(result).toEqual({ duplicate: false, consultationId: "consultation-1" });
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it("treats the database unique key as replay authority", async () => {
    const tx = transaction({ inserted: 0 });

    await expect(applyZoomParticipantAttendanceEvent(tx as never, attendanceEvent)).resolves.toEqual({
      duplicate: true,
      consultationId: "consultation-1"
    });
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown key or wrong meeting before persistence", async () => {
    for (const tx of [transaction({ credential: null }), transaction({ meetingId: "other-meeting" })]) {
      await expect(applyZoomParticipantAttendanceEvent(tx as never, attendanceEvent)).rejects.toBeInstanceOf(
        ZoomAttendanceWebhookError
      );
      expect(tx.$queryRaw).not.toHaveBeenCalled();
      expect(tx.consultationAttendanceEvent.createMany).not.toHaveBeenCalled();
    }
  });

  it("rejects provider occurrence times outside the issued credential window", async () => {
    const tx = transaction();

    await expect(
      applyZoomParticipantAttendanceEvent(tx as never, {
        ...attendanceEvent,
        occurredAt: new Date("2030-01-01T12:00:00.001Z")
      })
    ).rejects.toMatchObject({ code: "credential_time_mismatch" });
    expect(tx.consultationAttendanceEvent.createMany).not.toHaveBeenCalled();
  });
});
