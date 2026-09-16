export const CONSULTATION_RECORDING_PROVIDER = "zoom" as const;
export const CONSULTATION_RECORDING_FILE_TYPE = "mp4" as const;
export const CONSULTATION_RECORDING_TYPE = "shared_screen_with_speaker_view" as const;
export const CONSULTATION_RECORDING_MIME_TYPE = "video/mp4" as const;

export const consultationRecordingEligibilityWhere = {
  provider: CONSULTATION_RECORDING_PROVIDER,
  fileType: CONSULTATION_RECORDING_FILE_TYPE,
  recordingType: CONSULTATION_RECORDING_TYPE
} as const;

export function isEligibleConsultationRecordingMetadata(recording: {
  fileType: string;
  recordingType: string;
}): boolean {
  return (
    recording.fileType.trim().toLowerCase() === CONSULTATION_RECORDING_FILE_TYPE &&
    recording.recordingType.trim().toLowerCase() === CONSULTATION_RECORDING_TYPE
  );
}

export function isEligibleConsultationRecordingMimeType(contentType: string): boolean {
  return contentType.split(";", 1)[0]?.trim().toLowerCase() === CONSULTATION_RECORDING_MIME_TYPE;
}
