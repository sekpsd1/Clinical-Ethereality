import { z } from "zod";

const identifier = z.string().min(1).max(191).regex(/^[A-Za-z0-9_+=/.-]+$/);
export const archiveTargetSchema = z.object({
  recordingId: identifier,
  consultationId: identifier,
  providerRecordingId: identifier,
  zoomMeetingId: identifier,
  fileSizeBytes: z.string().regex(/^[1-9][0-9]{0,15}$/).refine(value => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER)),
  fileType: z.enum(["mp4", "txt"]),
  recordingType: z.enum(["shared_screen_with_speaker_view", "chat_file"])
}).strict().refine(value => value.fileType === "mp4"
  ? value.recordingType === "shared_screen_with_speaker_view" : value.recordingType === "chat_file");
export type ArchiveTarget = z.infer<typeof archiveTargetSchema>;
export const archiveJobBodySchema = z.object({ target: archiveTargetSchema }).strict();
