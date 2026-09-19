import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultationRecordingsPanel } from "@/features/consultations/recordings/ConsultationRecordingsPanel";
import { recordingHandoffUiCopy } from "@/features/consultations/recordings/RecordingHandoffActions";
import {
  mapConsultationRecording,
  mapEligibleConsultationRecordings
} from "@/features/consultations/recordings/presentation";

describe("consultation recording presentation", () => {
  it("maps Zoom video metadata to clear Thai labels", () => {
    const item = mapConsultationRecording({
      id: "recording-video-1",
      recordingType: "shared_screen_with_speaker_view",
      fileType: "mp4",
      fileSizeBytes: BigInt(2 * 1024 * 1024),
      startedAt: new Date("2030-01-01T10:00:00.000Z"),
      endedAt: new Date("2030-01-01T10:30:00.000Z"),
      retentionUntil: new Date("2035-01-01T10:00:00.000Z"),
      createdAt: new Date("2030-01-01T10:31:00.000Z")
    });

    expect(item).toMatchObject({
      id: "recording-video-1",
      kind: "video",
      title: "วิดีโอหน้าจอและผู้พูด",
      fileTypeLabel: "MP4",
      fileSizeLabel: "2 MB",
      durationLabel: "30 นาที"
    });
    expect(item.recordedAtLabel).toBeTruthy();
    expect(item.retentionUntilLabel).toBeTruthy();
  });

  it("maps Zoom chat TXT metadata to the dedicated chat presentation", () => {
    const item = mapConsultationRecording({
      id: "recording-chat-1",
      recordingType: "chat_file",
      fileType: "txt",
      fileSizeBytes: BigInt(1024),
      startedAt: new Date("2030-01-01T10:00:00.000Z"),
      endedAt: new Date("2030-01-01T10:30:00.000Z"),
      retentionUntil: new Date("2035-01-01T10:00:00.000Z"),
      createdAt: new Date("2030-01-01T10:31:00.000Z")
    });

    expect(item).toMatchObject({
      id: "recording-chat-1",
      kind: "chat",
      title: "ข้อความแชทระหว่างปรึกษา",
      fileTypeLabel: "TXT",
      fileSizeLabel: "1 KB",
      durationLabel: "30 นาที"
    });
  });

  it("renders client handoff actions without raw protected recording anchors", () => {
    const recording = mapConsultationRecording({
      id: "recording-video-1",
      recordingType: "shared_screen_with_speaker_view",
      fileType: "MP4",
      fileSizeBytes: null,
      startedAt: new Date("2030-01-01T10:00:00.000Z"),
      endedAt: new Date("2030-01-01T10:05:00.000Z"),
      retentionUntil: new Date("2035-01-01T10:00:00.000Z"),
      createdAt: new Date("2030-01-01T10:06:00.000Z")
    });
    const html = renderToStaticMarkup(
      createElement(ConsultationRecordingsPanel, {
        consultationId: "consultation-1",
        recordings: [recording]
      })
    );

    expect(html).toContain("บันทึกการปรึกษา");
    expect(html).toContain("1 ไฟล์");
    expect(html).toContain("ตรวจสอบเพื่อเปิด");
    expect(html).toContain("ตรวจสอบเพื่อดาวน์โหลด");
    expect(html).toContain("ตรวจสอบความพร้อมจาก Zoom");
    expect(html).toContain("grid-cols-2");
    expect(html).not.toContain("href=\"/api/consultations/");
    expect(html).toContain("aria-live=\"polite\"");
    expect(html).toContain("เฉพาะแอดมินและแพทย์ผู้รับผิดชอบเคสนี้เท่านั้น");
  });

  it("explains the Zoom processing state when a completed consultation has no files yet", () => {
    const html = renderToStaticMarkup(
      createElement(ConsultationRecordingsPanel, {
        consultationId: "consultation-1",
        recordings: []
      })
    );

    expect(html).toContain("ยังไม่มีไฟล์บันทึก");
    expect(html).toContain("กรุณารอ Zoom ประมวลผลสักครู่");
  });

  it("provides an explicit Thai unavailable state for a deliberate readiness retry", () => {
    expect(recordingHandoffUiCopy.unavailable).toContain("ไฟล์ยังไม่พร้อมใช้งาน");
    expect(recordingHandoffUiCopy.unavailable).toContain("ตรวจสอบอีกครั้ง");
  });

  it("counts and renders exactly the screen-and-speaker MP4 and chat TXT", () => {
    const base = {
      fileSizeBytes: BigInt(1024),
      startedAt: new Date("2030-01-01T10:00:00.000Z"),
      endedAt: new Date("2030-01-01T10:05:00.000Z"),
      retentionUntil: new Date("2035-01-01T10:00:00.000Z"),
      createdAt: new Date("2030-01-01T10:06:00.000Z")
    };
    const recordings = mapEligibleConsultationRecordings([
      { ...base, id: "recording-video-1", fileType: "mp4", recordingType: "shared_screen_with_speaker_view" },
      { ...base, id: "recording-chat-1", fileType: "txt", recordingType: "chat_file" },
      { ...base, id: "recording-audio-1", fileType: "m4a", recordingType: "audio_only" },
      { ...base, id: "recording-timeline-1", fileType: "timeline", recordingType: "timeline" },
      { ...base, id: "recording-transcript-1", fileType: "vtt", recordingType: "audio_transcript" },
      { ...base, id: "recording-gallery-1", fileType: "mp4", recordingType: "shared_screen_with_gallery_view" }
    ]);
    const html = renderToStaticMarkup(
      createElement(ConsultationRecordingsPanel, {
        consultationId: "consultation-1",
        recordings
      })
    );

    expect(recordings).toHaveLength(2);
    expect(html).toContain("2 ไฟล์");
    expect(html).toContain("วิดีโอหน้าจอและผู้พูด");
    expect(html).toContain("ข้อความแชทระหว่างปรึกษา");
    expect(html).toContain("data-recording-kind=\"video\"");
    expect(html).toContain("data-recording-kind=\"chat\"");
    expect(html).not.toContain("ไฟล์เสียงการปรึกษา");
    expect(html).not.toContain("recording-timeline-1");
    expect(html).not.toContain("recording-transcript-1");
    expect(html).not.toContain("recording-gallery-1");
  });
});
