import type { ConsultationStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission } from "@/lib/permissions";
import type { CustomerAppointmentData, CustomerAppointmentDetail } from "@/features/consultations/appointment/types";

type ConsultationRecord = NonNullable<Awaited<ReturnType<typeof getConsultationRecord>>>;

const statusContent: Record<
  ConsultationStatus,
  {
    label: string;
    tone: CustomerAppointmentDetail["statusTone"];
    nextStepLabel: string;
    nextStepDescription: string;
    ctaLabel: string;
  }
> = {
  requested: {
    label: "รอยืนยัน",
    tone: "neutral",
    nextStepLabel: "รอการยืนยัน",
    nextStepDescription: "ระบบกำลังเตรียมคำขอนัดหมายก่อนเปิดขั้นตอนชำระเงิน",
    ctaLabel: "ตรวจสอบการจอง"
  },
  pending_payment: {
    label: "รอชำระเงิน",
    tone: "warning",
    nextStepLabel: "ชำระค่าปรึกษา",
    nextStepDescription: "ชำระค่าปรึกษาเพื่อยืนยันและสำรองเวลานัดหมายนี้",
    ctaLabel: "ไปหน้าชำระเงิน"
  },
  scheduled: {
    label: "นัดหมายแล้ว",
    tone: "success",
    nextStepLabel: "เตรียมเข้าพบแพทย์",
    nextStepDescription: "ยืนยันการชำระเงินแล้ว กรุณาเข้าห้องรอก่อนเวลานัด",
    ctaLabel: "เปิดห้องรอ"
  },
  live: {
    label: "กำลังปรึกษา",
    tone: "success",
    nextStepLabel: "เข้าปรึกษาแพทย์",
    nextStepDescription: "การปรึกษาของคุณเริ่มแล้ว เข้าห้องรอเพื่อดำเนินการต่อ",
    ctaLabel: "เข้าปรึกษา"
  },
  completed: {
    label: "เสร็จสิ้น",
    tone: "neutral",
    nextStepLabel: "ดูคำแนะนำแพทย์",
    nextStepDescription: "การปรึกษาเสร็จสิ้นแล้ว ตรวจสอบบันทึกคำแนะนำและขั้นตอนถัดไป",
    ctaLabel: "ดูคำแนะนำ"
  },
  cancelled: {
    label: "ยกเลิกแล้ว",
    tone: "danger",
    nextStepLabel: "เลือกเวลานัดใหม่",
    nextStepDescription: "นัดหมายนี้ไม่ได้ใช้งานแล้ว",
    ctaLabel: "เลือกเวลาใหม่"
  }
};

function getConsultationRecord(consultationId: string, patientId: string) {
  return prisma.consultation.findFirst({
    where: {
      id: consultationId,
      patientId
    },
    include: {
      doctor: {
        include: {
          user: {
            select: {
              displayName: true,
              avatarUrl: true
            }
          }
        }
      }
    }
  });
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "รอยืนยันเวลา";
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "full"
  }).format(date);
}

function formatTime(date: Date | null): string {
  if (!date) {
    return "รอยืนยัน";
  }

  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatMoney(value: number | null): string {
  return new Intl.NumberFormat("th-TH", {
    currency: "THB",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value ?? 1000);
}

function getCtaHref(status: ConsultationStatus, consultationId: string): string {
  if (status === "scheduled" || status === "live") {
    return `/consult/waiting-room?consultation=${consultationId}`;
  }

  if (status === "completed") {
    return "/consult/advice-log";
  }

  if (status === "cancelled") {
    return "/consult/booking/somchai";
  }

  return `/consult/payment?consultation=${consultationId}`;
}

function mapConsultation(consultation: ConsultationRecord): CustomerAppointmentDetail {
  const status = statusContent[consultation.status];
  const avatarUrl = consultation.doctor.user.avatarUrl?.startsWith("/")
    ? consultation.doctor.user.avatarUrl
    : "/images/doctors/somchai-payment.png";

  return {
    id: consultation.id,
    doctorName: consultation.doctor.user.displayName ?? "นพ. สมชาย อนุมัติ",
    doctorSpecialty: consultation.doctor.specialty ?? "เวชศาสตร์ชะลอวัย",
    doctorAvatarUrl: avatarUrl,
    scheduledDate: formatDate(consultation.scheduledAt),
    scheduledTime: formatTime(consultation.scheduledAt),
    scheduledIso: consultation.scheduledAt?.toISOString() ?? null,
    status: consultation.status,
    statusLabel: status.label,
    statusTone: status.tone,
    feeLabel: formatMoney(consultation.doctor.consultationFee),
    nextStepLabel: status.nextStepLabel,
    nextStepDescription: status.nextStepDescription,
    ctaLabel: status.ctaLabel,
    ctaHref: getCtaHref(consultation.status, consultation.id)
  };
}

export async function getCustomerAppointmentDetail(
  session: PublicSession,
  consultationId: string
): Promise<CustomerAppointmentData> {
  noStore();
  assertPermission(session, "consultation:read:self");

  try {
    const consultation = await getConsultationRecord(consultationId, session.userId);

    return {
      appointment: consultation ? mapConsultation(consultation) : null
    };
  } catch {
    return {
      appointment: null,
      unavailable: true
    };
  }
}
