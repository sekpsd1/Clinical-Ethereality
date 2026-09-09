import { createHash } from "node:crypto";
import { z } from "zod";

const recordingFileSchema = z.object({
  id: z.union([z.string().min(1).max(191), z.number().int().nonnegative()]),
  file_type: z.string().trim().regex(/^[A-Za-z0-9]{1,40}$/),
  recording_type: z.string().trim().min(1).max(80),
  file_size: z.number().int().nonnegative().safe().optional(),
  recording_start: z.string().datetime().optional(),
  recording_end: z.string().datetime().optional(),
  status: z.literal("completed")
}).passthrough();

const zoomRecordingCompletedSchema = z.object({
  event: z.literal("recording.completed"),
  event_ts: z.number().finite(),
  payload: z.object({
    object: z.object({
      id: z.union([z.string().min(1), z.number()]),
      uuid: z.string().min(1).max(512),
      recording_files: z.array(recordingFileSchema).min(1).max(30)
    }).passthrough()
  }).passthrough()
}).passthrough();

export type ZoomRecordingCompletedEvent = {
  eventKey: string;
  meetingId: string;
  occurredAt: Date;
  files: Array<{
    providerRecordingId: string;
    fileType: string;
    recordingType: string;
    fileSizeBytes: bigint | null;
    startedAt: Date | null;
    endedAt: Date | null;
  }>;
};

function toDate(value: string | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function parseZoomRecordingCompletedEvent(value: unknown): ZoomRecordingCompletedEvent | null {
  const parsed = zoomRecordingCompletedSchema.safeParse(value);
  if (!parsed.success) return null;

  const eventMilliseconds = parsed.data.event_ts > 10_000_000_000
    ? parsed.data.event_ts
    : parsed.data.event_ts * 1000;
  const occurredAt = new Date(eventMilliseconds);
  if (!Number.isFinite(occurredAt.getTime())) return null;

  const providerRecordingIds = parsed.data.payload.object.recording_files
    .map((file) => String(file.id))
    .sort();
  const eventKey = createHash("sha256")
    .update([
      parsed.data.event,
      parsed.data.payload.object.uuid,
      ...providerRecordingIds
    ].join(":"))
    .digest("hex");

  return {
    eventKey,
    meetingId: String(parsed.data.payload.object.id),
    occurredAt,
    files: parsed.data.payload.object.recording_files.map((file) => ({
      providerRecordingId: String(file.id),
      fileType: file.file_type.toLowerCase(),
      recordingType: file.recording_type,
      fileSizeBytes: file.file_size === undefined ? null : BigInt(file.file_size),
      startedAt: toDate(file.recording_start),
      endedAt: toDate(file.recording_end)
    }))
  };
}
