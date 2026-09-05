export type DoctorScheduleDeactivatePreflight = {
  targetDoctors: number;
  activeRecurringAvailability: number;
  futureDateOverrides: number;
};

export function getDoctorScheduleDeactivateConflict(input: DoctorScheduleDeactivatePreflight): string | null {
  if (input.targetDoctors === 0) return "ไม่พบแพทย์ที่พร้อมรับนัดให้ปิดตาราง";
  return null;
}
