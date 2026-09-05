import type { ConsultationStatus } from "@prisma/client";

export type AdminCustomerJourneyTone = "neutral" | "success" | "warning" | "danger";

export type AdminConsultationStatusCopy = {
  label: string;
  paymentLabel: string;
  tone: AdminCustomerJourneyTone;
};

const consultationStatusCopy: Record<ConsultationStatus, AdminConsultationStatusCopy> = {
  requested: {
    label: "รอยืนยันนัดหมาย",
    paymentLabel: "ยังไม่เริ่มชำระ",
    tone: "neutral"
  },
  pending_payment: {
    label: "จองแล้ว รอชำระเงิน",
    paymentLabel: "รอชำระค่าปรึกษา",
    tone: "warning"
  },
  reschedule_required: {
    label: "ชำระเงิน/ตรวจรายการแล้ว รอเลือกเวลาใหม่",
    paymentLabel: "ตรวจสถานะจาก Payment",
    tone: "warning"
  },
  scheduled: {
    label: "ยืนยันนัดหมายแล้ว",
    paymentLabel: "ชำระค่าปรึกษาแล้ว",
    tone: "success"
  },
  live: {
    label: "กำลังปรึกษา",
    paymentLabel: "ชำระค่าปรึกษาแล้ว",
    tone: "success"
  },
  completed: {
    label: "ปรึกษาเสร็จสิ้น",
    paymentLabel: "ปิดขั้นตอนแล้ว",
    tone: "success"
  },
  cancelled: {
    label: "ยกเลิกหรือหมดอายุ",
    paymentLabel: "ไม่ได้ชำระเงิน",
    tone: "danger"
  }
};

export function getAdminConsultationStatusCopy(status: ConsultationStatus): AdminConsultationStatusCopy {
  return consultationStatusCopy[status];
}

export function isAssessmentActive(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() > now.getTime();
}

export function getCustomerJourneyLabel(input: {
  hasAssessment: boolean;
  assessmentIsActive: boolean;
  consultationStatus: ConsultationStatus | null;
}): string {
  if (!input.hasAssessment) {
    return "ยังไม่ทำแบบประเมิน";
  }

  if (!input.assessmentIsActive && !input.consultationStatus) {
    return "แบบประเมินหมดอายุ";
  }

  if (!input.consultationStatus) {
    return "ทำแบบประเมินแล้ว รอจอง";
  }

  return getAdminConsultationStatusCopy(input.consultationStatus).label;
}
