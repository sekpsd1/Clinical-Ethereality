export type ConsultationRecordingKind = "audio" | "chat" | "file" | "transcript" | "video";

export type ConsultationRecordingListItem = {
  id: string;
  kind: ConsultationRecordingKind;
  title: string;
  fileTypeLabel: string;
  fileSizeLabel: string | null;
  recordedAtLabel: string;
  durationLabel: string | null;
  retentionUntilLabel: string;
};

export type ConsultationRecordingPresentationInput = {
  id: string;
  recordingType: string;
  fileType: string;
  fileSizeBytes: bigint | null;
  startedAt: Date | null;
  endedAt: Date | null;
  retentionUntil: Date;
  createdAt: Date;
};

const recordingTypeTitles: Record<string, string> = {
  active_speaker: "วิดีโอผู้พูด",
  audio_only: "ไฟล์เสียงการปรึกษา",
  audio_transcript: "คำถอดเสียงการปรึกษา",
  chat_file: "ข้อความแชทระหว่างปรึกษา",
  gallery_view: "วิดีโอแบบแกลเลอรี",
  shared_screen_with_gallery_view: "วิดีโอหน้าจอและแกลเลอรี",
  shared_screen_with_speaker_view: "วิดีโอหน้าจอและผู้พูด",
  speaker_view: "วิดีโอผู้พูด"
};

function getRecordingKind(recordingType: string, fileType: string): ConsultationRecordingKind {
  const normalizedType = recordingType.toLowerCase();
  const normalizedFileType = fileType.toUpperCase();

  if (normalizedFileType === "MP4") return "video";
  if (["M4A", "MP3", "WAV"].includes(normalizedFileType)) return "audio";
  if (normalizedType.includes("transcript") || ["VTT", "SRT"].includes(normalizedFileType)) return "transcript";
  if (normalizedType.includes("chat")) return "chat";
  return "file";
}

function getRecordingTitle(recordingType: string, kind: ConsultationRecordingKind): string {
  const normalizedType = recordingType.toLowerCase();
  const knownTitle = recordingTypeTitles[normalizedType];
  if (knownTitle) return knownTitle;

  return {
    audio: "ไฟล์เสียงการปรึกษา",
    chat: "ข้อความแชทระหว่างปรึกษา",
    file: "ไฟล์บันทึกการปรึกษา",
    transcript: "คำถอดเสียงการปรึกษา",
    video: "วิดีโอการปรึกษา"
  }[kind];
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok"
  }).format(date);
}

function formatFileSize(bytes: bigint | null): string | null {
  if (bytes === null || bytes < BigInt(0)) return null;
  if (bytes < BigInt(1024)) return `${bytes.toString()} ไบต์`;

  const numericBytes = Number(bytes);
  const units = ["KB", "MB", "GB"];
  let value = numericBytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)} ${units[unitIndex]}`;
}

function formatDuration(startedAt: Date | null, endedAt: Date | null): string | null {
  if (!startedAt || !endedAt || endedAt <= startedAt) return null;

  const totalSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  if (totalSeconds < 60) return `${totalSeconds} วินาที`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} นาที` : `${minutes} นาที ${seconds} วินาที`;
}

export function mapConsultationRecording(
  recording: ConsultationRecordingPresentationInput
): ConsultationRecordingListItem {
  const kind = getRecordingKind(recording.recordingType, recording.fileType);

  return {
    id: recording.id,
    kind,
    title: getRecordingTitle(recording.recordingType, kind),
    fileTypeLabel: recording.fileType.toUpperCase(),
    fileSizeLabel: formatFileSize(recording.fileSizeBytes),
    recordedAtLabel: formatDateTime(recording.startedAt ?? recording.createdAt),
    durationLabel: formatDuration(recording.startedAt, recording.endedAt),
    retentionUntilLabel: formatDate(recording.retentionUntil)
  };
}
