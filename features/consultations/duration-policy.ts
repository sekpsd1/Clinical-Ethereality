export const NEW_CONSULTATION_DURATION_MINUTES = 15;
export const LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES = 30;

export const CONSULTATION_DURATION_OPTIONS = [NEW_CONSULTATION_DURATION_MINUTES] as const;

const LEGACY_BOOKED_CONSULTATION_DURATION_OPTIONS = [15, 30, 45, 60] as const;

export function getNewScheduleDurationMinutes(existingDurationMinutes?: number | null): number {
  void existingDurationMinutes;
  return NEW_CONSULTATION_DURATION_MINUTES;
}

export function getBookedConsultationDurationMinutes(bookedDurationMinutes?: number | null): number {
  if (
    typeof bookedDurationMinutes === "number" &&
    LEGACY_BOOKED_CONSULTATION_DURATION_OPTIONS.some((duration) => duration === bookedDurationMinutes)
  ) {
    return bookedDurationMinutes;
  }

  return LEGACY_CONSULTATION_DURATION_FALLBACK_MINUTES;
}
