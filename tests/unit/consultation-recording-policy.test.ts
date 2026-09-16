import { describe, expect, it } from "vitest";
import {
  consultationRecordingEligibilityWhere,
  isEligibleConsultationRecordingMetadata,
  isEligibleConsultationRecordingMimeType
} from "@/features/consultations/recordings/policy";

describe("consultation recording MP4-only policy", () => {
  it("uses the canonical Zoom screen-and-speaker MP4 metadata", () => {
    expect(consultationRecordingEligibilityWhere).toEqual({
      provider: "zoom",
      fileType: "mp4",
      recordingType: "shared_screen_with_speaker_view"
    });
    expect(isEligibleConsultationRecordingMetadata({
      fileType: "MP4",
      recordingType: "shared_screen_with_speaker_view"
    })).toBe(true);
  });

  it.each([
    { fileType: "m4a", recordingType: "audio_only" },
    { fileType: "timeline", recordingType: "timeline" },
    { fileType: "mp4", recordingType: "speaker_view" },
    { fileType: "mp4", recordingType: "shared_screen_with_gallery_view" }
  ])("rejects non-target metadata %#", (recording) => {
    expect(isEligibleConsultationRecordingMetadata(recording)).toBe(false);
  });

  it("accepts only the video/mp4 MIME essence", () => {
    expect(isEligibleConsultationRecordingMimeType("video/mp4")).toBe(true);
    expect(isEligibleConsultationRecordingMimeType("video/mp4; charset=binary")).toBe(true);
    expect(isEligibleConsultationRecordingMimeType("audio/mp4")).toBe(false);
    expect(isEligibleConsultationRecordingMimeType("application/octet-stream")).toBe(false);
  });
});
