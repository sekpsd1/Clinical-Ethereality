export type DoctorScheduleDeactivatePreflight = {
  targetDoctors: number;
  activeConsultations: number;
  pendingPayments: number;
  activeSlotLocks: number;
};

type TestResetPaymentCandidate = {
  id: string;
  verificationPayload: unknown;
  consultation: { id: string; status: string } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isCancelledTestResetPayment(payment: TestResetPaymentCandidate): boolean {
  if (payment.consultation?.status !== "cancelled" || !isRecord(payment.verificationPayload)) return false;
  const marker = payment.verificationPayload.testDataReset;
  if (!isRecord(marker)) return false;

  return marker.version === 1 &&
    marker.kind === "test_data_reset" &&
    marker.reason === "test_data_reset" &&
    marker.consultationId === payment.consultation.id &&
    marker.paymentId === payment.id &&
    typeof marker.cancelledAt === "string" && marker.cancelledAt.length > 0 &&
    typeof marker.cancelledById === "string" && marker.cancelledById.length > 0 &&
    typeof marker.previousConsultationStatus === "string" && marker.previousConsultationStatus.length > 0 &&
    typeof marker.paymentStatusAtReset === "string" && marker.paymentStatusAtReset.length > 0;
}

export function getDoctorScheduleDeactivateConflict(input: DoctorScheduleDeactivatePreflight): string | null {
  if (input.targetDoctors === 0) return "ไม่พบแพทย์ที่พร้อมรับนัดให้ปิดตาราง";
  if (input.activeConsultations > 0) return "ไม่สามารถปิดตารางทั้งหมดได้ เพราะยังมีนัดหมายที่ยังไม่สิ้นสุดหรือมีนัดในอนาคต";
  if (input.pendingPayments > 0) return "ไม่สามารถปิดตารางทั้งหมดได้ เพราะยังมีรายการชำระเงินค่าปรึกษาที่รอส่งสลิปหรือรอตรวจสอบ";
  if (input.activeSlotLocks > 0) return "ไม่สามารถปิดตารางทั้งหมดได้ เพราะยังมีการล็อกช่วงเวลานัดหมายที่ยังไม่หมดอายุ";
  return null;
}
