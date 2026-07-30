import { unstable_noStore as noStore } from "next/cache";
import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import { releaseExpiredConsultationSlotLocks } from "@/features/consultations/booking/lock-release";
import { getDoctorPatientReference } from "@/features/doctor/patient-reference";
import { parsePrescriptionItems } from "@/features/prescriptions/items";
import type { DoctorConsultationItem, DoctorConsultationsData } from "@/features/doctor/consultations/types";

type ConsultationWithDetails = Awaited<ReturnType<typeof getConsultationsForDoctor>>[number];

async function getDoctorScope(userId: string, role: string): Promise<string | null | undefined> {
  if (role === "admin") {
    return undefined;
  }

  const doctor = await prisma.doctor.findUnique({
    where: {
      userId
    },
    select: {
      id: true
    }
  });

  return doctor?.id ?? null;
}

function getConsultationsForDoctor(doctorId: string | undefined) {
  return prisma.consultation.findMany({
    where: doctorId
      ? {
          doctorId
        }
      : undefined,
    orderBy: [
      {
        scheduledAt: "desc"
      },
      {
        updatedAt: "desc"
      }
    ],
    take: 50,
    include: {
      patient: true,
      assessment: true,
      prescriptions: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 3
      },
      messages: {
        where: {
          status: "visible"
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        include: {
          sender: true
        }
      },
      payment: true
    }
  });
}

function formatDate(date: Date | null): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getWorkflowStatus(
  status: ConsultationWithDetails["status"],
  payment: ConsultationWithDetails["payment"]
): Pick<
  DoctorConsultationItem,
  | "readinessLabel"
  | "readinessTitle"
  | "readinessDescription"
  | "readinessTone"
  | "paymentStatusLabel"
  | "paymentStatusDescription"
  | "canOpenConsultRoom"
  | "consultRoomHref"
> {
  const paymentCopy = getPaymentStatusCopy(status, payment?.status ?? null);

  if (status === "pending_payment") {
    return {
      readinessLabel: payment?.status === "rejected" ? "สลิปไม่ผ่าน" : "รอชำระเงิน",
      readinessTitle: "ยังไม่พร้อมตรวจ",
      readinessDescription:
        payment?.status === "rejected"
          ? "หลักฐานการชำระเงินไม่ผ่าน ลูกค้าต้องส่งข้อมูลใหม่ก่อนเริ่ม consult"
          : "ลูกค้ายังไม่ยืนยันค่าปรึกษา กรุณารอการชำระเงินก่อนเริ่ม consult",
      readinessTone: payment?.status === "rejected" ? "danger" : "warning",
      ...paymentCopy,
      canOpenConsultRoom: false,
      consultRoomHref: null
    };
  }

  if (status === "scheduled" || status === "live") {
    return {
      readinessLabel: status === "live" ? "กำลังปรึกษา" : "พร้อมตรวจ",
      readinessTitle: status === "live" ? "กำลังอยู่ใน consult" : "พร้อมเริ่ม consult",
      readinessDescription: "ชำระเงินแล้ว ตรวจแบบประเมินก่อน consult แล้วเข้าแชทหรือออกใบสั่งยาได้ตามความเหมาะสม",
      readinessTone: "success",
      ...paymentCopy,
      canOpenConsultRoom: true,
      consultRoomHref: null
    };
  }

  if (status === "completed") {
    return {
      readinessLabel: "เสร็จสิ้น",
      readinessTitle: "consult เสร็จแล้ว",
      readinessDescription: "ตรวจย้อนหลัง บันทึกคำแนะนำ หรือทบทวนใบสั่งยาได้",
      readinessTone: "neutral",
      ...paymentCopy,
      canOpenConsultRoom: true,
      consultRoomHref: null
    };
  }

  if (status === "cancelled") {
    return {
      readinessLabel: "หมดอายุ/ยกเลิก",
      readinessTitle: "ไม่พร้อมตรวจ",
      readinessDescription: "นัดหมายนี้ถูกยกเลิกหรือหมดเวลาจอง ไม่ควรเริ่ม consult",
      readinessTone: "danger",
      ...paymentCopy,
      canOpenConsultRoom: false,
      consultRoomHref: null
    };
  }

  return {
    readinessLabel: "รอยืนยัน",
    readinessTitle: "ยังไม่พร้อมตรวจ",
    readinessDescription: "ระบบยังเตรียมขั้นตอนนัดหมาย กรุณารอจนสถานะพร้อมตรวจ",
    readinessTone: "neutral",
    ...paymentCopy,
    canOpenConsultRoom: false,
    consultRoomHref: null
  };
}

function getPaymentStatusCopy(
  consultationStatus: ConsultationWithDetails["status"],
  paymentStatus: PaymentStatus | null
): Pick<DoctorConsultationItem, "paymentStatusLabel" | "paymentStatusDescription"> {
  if (paymentStatus === "verified") {
    return {
      paymentStatusLabel: "ยืนยันแล้ว",
      paymentStatusDescription: "มีบันทึกการตรวจหลักฐานชำระค่าปรึกษา"
    };
  }

  if (paymentStatus === "rejected") {
    return {
      paymentStatusLabel: "สลิปไม่ผ่าน",
      paymentStatusDescription: "ลูกค้าต้องส่งหลักฐานการชำระเงินใหม่"
    };
  }

  if (paymentStatus === "pending_review") {
    return {
      paymentStatusLabel: "รอตรวจสลิป",
      paymentStatusDescription: "มีหลักฐานแล้วและกำลังรอตรวจสอบ"
    };
  }

  if (paymentStatus === "pending_slip") {
    return {
      paymentStatusLabel: "รอสลิป",
      paymentStatusDescription: "ยังไม่มีหลักฐานการชำระเงิน"
    };
  }

  if (paymentStatus === "refunded") {
    return {
      paymentStatusLabel: "คืนเงินแล้ว",
      paymentStatusDescription: "รายการชำระเงินถูกคืนแล้ว"
    };
  }

  if (consultationStatus === "scheduled" || consultationStatus === "live" || consultationStatus === "completed") {
    return {
      paymentStatusLabel: "ยืนยันจากสถานะนัด",
      paymentStatusDescription: "ข้อมูลเดิมก่อนเริ่มเก็บหลักฐานชำระค่าปรึกษาแยก"
    };
  }

  if (consultationStatus === "cancelled") {
    return {
      paymentStatusLabel: "ไม่ได้ชำระเงิน",
      paymentStatusDescription: "slot ถูกปล่อยคืนหรือยกเลิกแล้ว"
    };
  }

  return {
    paymentStatusLabel: "ยังไม่มีบันทึก",
    paymentStatusDescription: "ยังไม่มีหลักฐานการชำระค่าปรึกษาในระบบ"
  };
}

function getPaymentEvidenceSummary(payment: ConsultationWithDetails["payment"]): string | null {
  if (!payment?.verificationPayload || typeof payment.verificationPayload !== "object" || Array.isArray(payment.verificationPayload)) {
    return null;
  }

  const payload = payment.verificationPayload as Record<string, unknown>;
  const result =
    payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)
      ? (payload.result as Record<string, unknown>)
      : {};
  const parts = [
    typeof payload.source === "string" ? `ผู้ตรวจ ${payload.source}` : null,
    typeof result.transRef === "string" ? `อ้างอิง ${result.transRef}` : null,
    typeof result.receiverName === "string" ? `ผู้รับ ${result.receiverName}` : null,
    typeof result.amount === "number" ? `ยอด ${new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(result.amount)}` : null
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" • ") : null;
}

function mapConsultation(consultation: ConsultationWithDetails): DoctorConsultationItem {
  const latestPrescription = consultation.prescriptions[0] ?? null;
  const latestMessage = consultation.messages[0] ?? null;
  const workflow = getWorkflowStatus(consultation.status, consultation.payment);

  return {
    id: consultation.id,
    patientName: consultation.patient.displayName ?? "LINE patient",
    patientLineId: getDoctorPatientReference(consultation.patient.lineUserId),
    status: consultation.status,
    readinessLabel: workflow.readinessLabel,
    readinessTitle: workflow.readinessTitle,
    readinessDescription: workflow.readinessDescription,
    readinessTone: workflow.readinessTone,
    paymentStatusLabel: workflow.paymentStatusLabel,
    paymentStatusDescription: workflow.paymentStatusDescription,
    paymentStatus: consultation.payment?.status ?? null,
    paymentEvidenceSummary: getPaymentEvidenceSummary(consultation.payment),
    paymentReviewedAt: formatDate(consultation.payment?.reviewedAt ?? null),
    canOpenConsultRoom: workflow.canOpenConsultRoom,
    consultRoomHref: workflow.canOpenConsultRoom ? `/consult/live?consultation=${consultation.id}` : null,
    scheduledAt: formatDate(consultation.scheduledAt),
    summary: consultation.summary,
    prescriptionCount: consultation.prescriptions.length,
    latestPrescriptionId: latestPrescription?.id ?? null,
    latestPrescriptionStatus: latestPrescription?.status ?? null,
    latestPrescriptionNotes: latestPrescription?.notes ?? null,
    latestPrescriptionMedication: parsePrescriptionItems(latestPrescription?.itemsJson)[0] ?? null,
    latestChatMessage: latestMessage
      ? {
          body: latestMessage.body,
          senderName: latestMessage.sender.displayName ?? latestMessage.sender.lineUserId,
          createdAt: formatDate(latestMessage.createdAt) ?? ""
        }
      : null,
    assessment: consultation.assessment
      ? {
          symptomLabel: consultation.assessment.symptomLabel,
          durationLabel: consultation.assessment.durationLabel,
          recommendationTopic: consultation.assessment.recommendationTopic,
          recommendationSpecialty: consultation.assessment.recommendationSpecialty,
          recommendationReason: consultation.assessment.recommendationReason,
          completedAt: formatDate(consultation.assessment.completedAt) ?? "",
          expiresAt: formatDate(consultation.assessment.expiresAt) ?? ""
        }
      : null,
    createdAt: formatDate(consultation.createdAt) ?? ""
  };
}

export async function getDoctorConsultations(): Promise<DoctorConsultationsData> {
  noStore();

  try {
    const session = await requireDoctorSession();
    await releaseExpiredConsultationSlotLocks();
    const doctorId = await getDoctorScope(session.userId, session.role);

    if (doctorId === null) {
      return {
        consultations: [],
        summary: {
          scheduled: 0,
          live: 0,
          completed: 0
        },
        missingDoctorProfile: true
      };
    }

    const consultations = await getConsultationsForDoctor(doctorId);
    const consultationItems = consultations.map(mapConsultation);

    return {
      consultations: consultationItems,
      summary: {
        scheduled: consultationItems.filter((consultation) => consultation.status === "scheduled").length,
        live: consultationItems.filter((consultation) => consultation.status === "live").length,
        completed: consultationItems.filter((consultation) => consultation.status === "completed").length
      }
    };
  } catch {
    return {
      consultations: [],
      summary: {
        scheduled: 0,
        live: 0,
        completed: 0
      },
      unavailable: true
    };
  }
}
