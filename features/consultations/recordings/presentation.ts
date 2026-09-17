import {
  getConsultationRecordingVariant,
  isEligibleConsultationRecordingMetadata
} from "@/features/consultations/recordings/policy";

export type ConsultationRecordingKind = "video" | "chat";

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
  const variant = getConsultationRecordingVariant(recording);
  if (!variant || !isEligibleConsultationRecordingMetadata(recording)) {
    throw new Error("Consultation recording is not available for presentation.");
  }

  return {
    id: recording.id,
    kind: variant.kind,
    title: variant.kind === "video" ? "วิดีโอหน้าจอและผู้พูด" : "ข้อความแชทระหว่างปรึกษา",
    fileTypeLabel: variant.fileType.toUpperCase(),
    fileSizeLabel: formatFileSize(recording.fileSizeBytes),
    recordedAtLabel: formatDateTime(recording.startedAt ?? recording.createdAt),
    durationLabel: formatDuration(recording.startedAt, recording.endedAt),
    retentionUntilLabel: formatDate(recording.retentionUntil)
  };
}

export function mapEligibleConsultationRecordings(
  recordings: ConsultationRecordingPresentationInput[]
): ConsultationRecordingListItem[] {
  return recordings
    .filter(isEligibleConsultationRecordingMetadata)
    .map(mapConsultationRecording);
}
