import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConsultationRecordingsPanel } from "@/features/consultations/recordings/ConsultationRecordingsPanel";
import { mapConsultationRecording } from "@/features/consultations/recordings/presentation";

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

  it("renders client handoff actions without raw protected recording anchors", () => {
    const recording = mapConsultationRecording({
      id: "recording-video-1",
      recordingType: "speaker_view",
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
    expect(html).toContain("เปิดดู");
    expect(html).toContain("ดาวน์โหลด");
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
});
