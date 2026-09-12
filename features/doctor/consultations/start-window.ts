import { DOCTOR_CONSULTATION_EARLY_START_MS } from "@/features/consultations/waiting-room/access";

export { DOCTOR_CONSULTATION_EARLY_START_MS } from "@/features/consultations/waiting-room/access";

export type DoctorConsultationStartWindow = {
  canStart: boolean;
  opensAt: Date | null;
  reason: "open" | "too_early" | "missing_appointment_time";
};

export function getDoctorConsultationStartWindow(
  scheduledAt: Date | null,
  now = new Date()
): DoctorConsultationStartWindow {
  if (!scheduledAt) {
    return {
      canStart: false,
      opensAt: null,
      reason: "missing_appointment_time"
    };
  }

  const opensAt = new Date(scheduledAt.getTime() - DOCTOR_CONSULTATION_EARLY_START_MS);

  return now.getTime() >= opensAt.getTime()
    ? { canStart: true, opensAt, reason: "open" }
    : { canStart: false, opensAt, reason: "too_early" };
}
