import { describe, expect, it } from "vitest";
import {
  consultationRecordingEligibilityWhere,
  getConsultationRecordingVariant,
  isExactConsultationRecordingMetadata,
  isEligibleConsultationRecordingMetadata,
  isEligibleConsultationRecordingMimeType
} from "@/features/consultations/recordings/policy";

describe("consultation recording allowlist policy", () => {
  it("uses only the canonical Zoom screen-and-speaker MP4 and chat TXT metadata pairs", () => {
    expect(consultationRecordingEligibilityWhere).toEqual({
      provider: "zoom",
      OR: [
        { fileType: "mp4", recordingType: "shared_screen_with_speaker_view" },
        { fileType: "txt", recordingType: "chat_file" }
      ]
    });
    expect(isEligibleConsultationRecordingMetadata({
      fileType: "MP4",
      recordingType: "shared_screen_with_speaker_view"
    })).toBe(true);
    expect(isEligibleConsultationRecordingMetadata({
      fileType: "TXT",
      recordingType: "chat_file"
    })).toBe(true);
  });

  it.each([
    { fileType: "m4a", recordingType: "audio_only" },
    { fileType: "timeline", recordingType: "timeline" },
    { fileType: "vtt", recordingType: "audio_transcript" },
    { fileType: "mp4", recordingType: "speaker_view" },
    { fileType: "mp4", recordingType: "shared_screen_with_gallery_view" },
    { fileType: "txt", recordingType: "timeline" },
    { fileType: "mp4", recordingType: "chat_file" }
  ])("rejects non-target metadata %#", (recording) => {
    expect(isEligibleConsultationRecordingMetadata(recording)).toBe(false);
  });

  it("keys MIME and range behavior to the exact metadata pair", () => {
    const video = { fileType: "mp4", recordingType: "shared_screen_with_speaker_view" };
    const chat = { fileType: "txt", recordingType: "chat_file" };
    expect(isEligibleConsultationRecordingMimeType(video, "video/mp4; charset=binary")).toBe(true);
    expect(isEligibleConsultationRecordingMimeType(video, "text/plain")).toBe(false);
    expect(isEligibleConsultationRecordingMimeType(chat, "text/plain; charset=utf-8")).toBe(true);
    expect(isEligibleConsultationRecordingMimeType(chat, "text/plain; charset=\"UTF-8\"")).toBe(true);
    expect(isEligibleConsultationRecordingMimeType(chat, "text/plain; charset=iso-8859-1")).toBe(false);
    expect(isEligibleConsultationRecordingMimeType(chat, "text/html")).toBe(false);
    expect(isEligibleConsultationRecordingMimeType(chat, "application/octet-stream")).toBe(false);
    expect(getConsultationRecordingVariant(video)?.supportsByteRanges).toBe(true);
    expect(getConsultationRecordingVariant(chat)?.supportsByteRanges).toBe(false);
  });

  it("requires provider metadata to match the stored allowlisted pair", () => {
    const video = { fileType: "mp4", recordingType: "shared_screen_with_speaker_view" };
    const chat = { fileType: "txt", recordingType: "chat_file" };
    expect(isExactConsultationRecordingMetadata(video, { fileType: "MP4", recordingType: "shared_screen_with_speaker_view" })).toBe(true);
    expect(isExactConsultationRecordingMetadata(chat, { fileType: "TXT", recordingType: "chat_file" })).toBe(true);
    expect(isExactConsultationRecordingMetadata(video, chat)).toBe(false);
  });
});
