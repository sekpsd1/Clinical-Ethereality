export const TELEMEDICINE_CONSENT_VERSION = "2026-09-09";
export const TELEMEDICINE_RECORDING_RETENTION_YEARS = 5;

export const TELEMEDICINE_CONSENT_SCOPE = ["audio", "video", "chat_history"] as const;

export function isAtLeast18(dateOfBirth: Date, at: Date): boolean {
  const eighteenthBirthday = new Date(
    Date.UTC(
      dateOfBirth.getUTCFullYear() + 18,
      dateOfBirth.getUTCMonth(),
      dateOfBirth.getUTCDate()
    )
  );
  const comparisonDate = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
  );

  return comparisonDate >= eighteenthBirthday;
}

export function getRecordingRetentionUntil(recordedAt: Date): Date {
  const result = new Date(recordedAt);
  result.setUTCFullYear(result.getUTCFullYear() + TELEMEDICINE_RECORDING_RETENTION_YEARS);
  return result;
}
