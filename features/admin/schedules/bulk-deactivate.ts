export type DoctorScheduleDeactivatePreflight = {
  targetDoctors: number;
  activeConsultations: number;
  pendingPayments: number;
  activeSlotLocks: number;
};

export function getDoctorScheduleDeactivateConflict(input: DoctorScheduleDeactivatePreflight): string | null {
  if (input.targetDoctors === 0) return "ไม่พบแพทย์ที่พร้อมรับนัดให้ปิดตาราง";
  if (input.activeConsultations > 0) return "ไม่สามารถปิดตารางทั้งหมดได้ เพราะยังมีนัดหมายที่ยังไม่สิ้นสุดหรือมีนัดในอนาคต";
  if (input.pendingPayments > 0) return "ไม่สามารถปิดตารางทั้งหมดได้ เพราะยังมีรายการชำระเงินค่าปรึกษาที่รอส่งสลิปหรือรอตรวจสอบ";
  if (input.activeSlotLocks > 0) return "ไม่สามารถปิดตารางทั้งหมดได้ เพราะยังมีการล็อกช่วงเวลานัดหมายที่ยังไม่หมดอายุ";
  return null;
}
