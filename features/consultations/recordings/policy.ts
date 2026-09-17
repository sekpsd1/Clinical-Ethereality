export const CONSULTATION_RECORDING_PROVIDER = "zoom" as const;

export const CONSULTATION_RECORDING_VARIANTS = [
  {
    kind: "video",
    fileType: "mp4",
    recordingType: "shared_screen_with_speaker_view",
    providerMimeType: "video/mp4",
    responseMimeType: "video/mp4",
    supportsByteRanges: true
  },
  {
    kind: "chat",
    fileType: "txt",
    recordingType: "chat_file",
    providerMimeType: "text/plain",
    responseMimeType: "text/plain; charset=utf-8",
    supportsByteRanges: false
  }
] as const;

export type ConsultationRecordingVariant = (typeof CONSULTATION_RECORDING_VARIANTS)[number];

export const consultationRecordingEligibilityWhere = {
  provider: CONSULTATION_RECORDING_PROVIDER,
  OR: CONSULTATION_RECORDING_VARIANTS.map(({ fileType, recordingType }) => ({
    fileType,
    recordingType
  }))
} as const;

function normalizeMetadataValue(value: string): string {
  return value.trim().toLowerCase();
}

export function getConsultationRecordingVariant(recording: {
  fileType: string;
  recordingType: string;
}): ConsultationRecordingVariant | null {
  const fileType = normalizeMetadataValue(recording.fileType);
  const recordingType = normalizeMetadataValue(recording.recordingType);
  return CONSULTATION_RECORDING_VARIANTS.find(
    (variant) => variant.fileType === fileType && variant.recordingType === recordingType
  ) ?? null;
}

export function isEligibleConsultationRecordingMetadata(recording: {
  fileType: string;
  recordingType: string;
}): boolean {
  return getConsultationRecordingVariant(recording) !== null;
}

export function isEligibleConsultationRecordingMimeType(
  recording: { fileType: string; recordingType: string },
  contentType: string
): boolean {
  const variant = getConsultationRecordingVariant(recording);
  if (!variant) return false;

  const [essence, ...parameters] = contentType.split(";");
  if (essence?.trim().toLowerCase() !== variant.providerMimeType) return false;
  if (variant.kind !== "chat") return true;

  const charsets = parameters
    .map((parameter) => parameter.trim().toLowerCase())
    .filter((parameter) => parameter.startsWith("charset="));
  return charsets.length === 0 || (
    charsets.length === 1 &&
    (charsets[0] === "charset=utf-8" || charsets[0] === "charset=\"utf-8\"")
  );
}

export function isExactConsultationRecordingMetadata(
  expected: { fileType: string; recordingType: string },
  actual: { fileType: string; recordingType: string }
): boolean {
  const expectedVariant = getConsultationRecordingVariant(expected);
  const actualVariant = getConsultationRecordingVariant(actual);
  return expectedVariant !== null && expectedVariant === actualVariant;
}
