export function formatDoctorConsultationDuration(slotMinutes: number | null | undefined): string {
  if (!Number.isInteger(slotMinutes) || !slotMinutes || slotMinutes < 1) {
    return "ยังไม่ระบุ";
  }

  return `${slotMinutes} นาที`;
}
