import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/audit/audit-log", () => ({ writeAuditLog: mocks.writeAuditLog }));

import { parseZoomRecordingCompletedEvent } from "@/features/consultations/recordings/webhook-schema";
import { applyZoomRecordingCompletedEvent } from "@/features/consultations/recordings/webhook-service";

function payload() {
  return {
    event: "recording.completed",
    event_ts: 1893493800000,
    payload: {
      object: {
        id: 12345678901,
        uuid: "meeting-instance-uuid",
        recording_files: [
          {
            id: "recording-video-1",
            file_type: "MP4",
            recording_type: "shared_screen_with_speaker_view",
            file_size: 2048,
            recording_start: "2030-01-01T10:00:00.000Z",
            recording_end: "2030-01-01T10:30:00.000Z",
            status: "completed",
            download_url: "https://example.invalid/must-not-persist"
          }
        ]
      }
    }
  };
}

describe("Zoom recording webhook metadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes only allowlisted metadata and excludes provider URLs", () => {
    const parsed = parseZoomRecordingCompletedEvent(payload());
    expect(parsed).toMatchObject({
      meetingId: "12345678901",
      files: [{
        providerRecordingId: "recording-video-1",
        fileType: "mp4",
        recordingType: "shared_screen_with_speaker_view",
        fileSizeBytes: BigInt(2048)
      }]
    });
    expect(JSON.stringify(parsed, (_key, value) => typeof value === "bigint" ? value.toString() : value))
      .not.toContain("download_url");
  });

  it("rejects malformed or non-completed file payloads", () => {
    const value = payload();
    value.payload.object.recording_files[0].status = "processing";
    expect(parseZoomRecordingCompletedEvent(value)).toBeNull();
    expect(parseZoomRecordingCompletedEvent({ event: "recording.completed" })).toBeNull();
  });

  it("maps metadata to the consultation, retains it for five years, and is idempotent", async () => {
    const parsed = parseZoomRecordingCompletedEvent(payload())!;
    const tx = {
      consultation: { findFirst: vi.fn().mockResolvedValue({ id: "consultation-1" }) },
      consultationRecordingWebhookEvent: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      consultationRecording: { createMany: vi.fn().mockResolvedValue({ count: 1 }) }
    };

    const result = await applyZoomRecordingCompletedEvent(tx as unknown as Prisma.TransactionClient, parsed);
    expect(result).toEqual({ consultationId: "consultation-1", duplicate: false, recordingCount: 1 });
    expect(tx.consultation.findFirst).toHaveBeenCalledWith({
      where: { zoomMeetingId: "12345678901" },
      select: { id: true }
    });
    expect(tx.consultationRecording.createMany.mock.calls[0][0].data[0]).toMatchObject({
      consultationId: "consultation-1",
      providerRecordingId: "recording-video-1",
      retentionUntil: new Date("2035-01-01T10:30:00.000Z")
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();

    tx.consultationRecordingWebhookEvent.createMany.mockResolvedValue({ count: 0 });
    const duplicate = await applyZoomRecordingCompletedEvent(tx as unknown as Prisma.TransactionClient, parsed);
    expect(duplicate).toEqual({ consultationId: "consultation-1", duplicate: true, recordingCount: 0 });
    expect(tx.consultationRecording.createMany).toHaveBeenCalledTimes(1);
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(1);
  });
});
