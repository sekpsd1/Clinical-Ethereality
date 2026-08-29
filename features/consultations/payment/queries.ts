import type { ConsultationStatus } from "@prisma/client";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { PublicSession } from "@/lib/auth/types";
import { assertPermission } from "@/lib/permissions";
import { getPromptPayInstruction } from "@/lib/payments/promptpay";
import { paymentSlipEntityType } from "@/features/payments/private-slips";
import { getConsultationPaymentVerificationRetryAfterSeconds } from "@/features/consultations/payment/service";
import type {
  ConsultationPaymentData,
  ConsultationPaymentDetail,
  ConsultationPaymentStatus
} from "@/features/consultations/payment/types";

type ConsultationRecord = NonNullable<Awaited<ReturnType<typeof getConsultationRecord>>>;

const statusLabels: Record<ConsultationStatus, string> = {
  requested: "รอยืนยัน",
  pending_payment: "รอชำระเงิน",
  scheduled: "ชำระเงินแล้ว",
  live: "กำลังปรึกษา",
  completed: "เสร็จสิ้น",
  cancelled: "ยกเลิกแล้ว"
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
      },
      payment: {
        select: {
          id: true,
          status: true,
          verificationPayload: true
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
    dateStyle: "medium"
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

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(value)} บาท`;
}

function normalizePaymentStatus(value?: string): ConsultationPaymentStatus {
  if (value === "rejected" || value === "provider_error" || value === "cooldown" || value === "invalid" || value === "expired" || value === "not_found") {
    return value;
  }

  return "idle";
}

async function mapConsultation(consultation: ConsultationRecord): Promise<ConsultationPaymentDetail> {
  const feeAmount = consultation.doctor.consultationFee ?? 1000;
  const promptPay = await getPromptPayInstruction(feeAmount);
  const doctorAvatarUrl = consultation.doctor.user.avatarUrl?.startsWith("/")
    ? consultation.doctor.user.avatarUrl
    : "/images/doctors/somchai-payment.png";
  const privateSlipAttachment =
    consultation.payment?.status === "pending_review"
      ? await prisma.fileAttachment.findFirst({
          where: {
            entityId: consultation.payment.id,
            entityType: paymentSlipEntityType,
            ownerId: consultation.patientId,
            purpose: "payment_slip",
            status: "attached",
            storageKey: { not: null }
          },
          select: { id: true }
        })
      : null;

  return {
    id: consultation.id,
    doctorName: consultation.doctor.user.displayName ?? "นพ. สมชาย อนุมัติ",
    doctorSpecialty: consultation.doctor.specialty ?? "เวชศาสตร์ชะลอวัย",
    doctorAvatarUrl,
    scheduledDate: formatDate(consultation.scheduledAt),
    scheduledTime: formatTime(consultation.scheduledAt),
    status: consultation.status,
    statusLabel: statusLabels[consultation.status],
    feeAmount,
    feeLabel: formatMoney(feeAmount),
    appointmentHref: `/consult/appointments/${consultation.id}`,
    waitingRoomHref: `/consult/waiting-room?consultation=${consultation.id}`,
    privateSlipAttachmentId: privateSlipAttachment?.id ?? null,
    promptPay,
    verificationRetryAfterSeconds: consultation.payment
      ? getConsultationPaymentVerificationRetryAfterSeconds(consultation.payment)
      : 0
  };
}

export async function getConsultationPaymentData(
  session: PublicSession,
  consultationId?: string,
  payment?: string
): Promise<ConsultationPaymentData> {
  noStore();
  assertPermission(session, "consultation:read:self");

  if (!consultationId) {
    return {
      consultation: null,
      paymentStatus: "not_found"
    };
  }

  try {
    const consultation = await getConsultationRecord(consultationId, session.userId);

    return {
      consultation: consultation ? await mapConsultation(consultation) : null,
      paymentStatus: consultation ? normalizePaymentStatus(payment) : "not_found"
    };
  } catch {
    return {
      consultation: null,
      paymentStatus: "idle",
      unavailable: true
    };
  }
}
