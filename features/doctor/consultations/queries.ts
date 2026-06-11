import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireDoctorSession } from "@/lib/auth/guards";
import { releaseExpiredConsultationSlotLocks } from "@/features/consultations/booking/lock-release";
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
      }
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

function getWorkflowStatus(status: ConsultationWithDetails["status"]): Pick<
  DoctorConsultationItem,
  "readinessLabel" | "readinessTitle" | "readinessDescription" | "readinessTone" | "paymentStatusLabel" | "paymentStatusDescription" | "canOpenConsultRoom" | "consultRoomHref"
> {
  if (status === "pending_payment") {
    return {
      readinessLabel: "รอชำระเงิน",
      readinessTitle: "ยังไม่พร้อมตรวจ",
      readinessDescription: "ลูกค้ายังไม่ยืนยันค่าปรึกษา กรุณารอการชำระเงินก่อนเริ่ม consult",
      readinessTone: "warning",
      paymentStatusLabel: "รอชำระเงิน",
      paymentStatusDescription: "ยังไม่ควรเริ่ม consult หรือออกใบสั่งยา",
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
      paymentStatusLabel: "ชำระเงินแล้ว",
      paymentStatusDescription: "ยืนยันค่าปรึกษาแล้ว",
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
      paymentStatusLabel: "ปิดขั้นตอนแล้ว",
      paymentStatusDescription: "ไม่ต้องดำเนินการชำระเงินเพิ่ม",
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
      paymentStatusLabel: "ไม่ได้ชำระเงิน",
      paymentStatusDescription: "slot ถูกปล่อยคืนหรือยกเลิกแล้ว",
      canOpenConsultRoom: false,
      consultRoomHref: null
    };
  }

  return {
    readinessLabel: "รอยืนยัน",
    readinessTitle: "ยังไม่พร้อมตรวจ",
    readinessDescription: "ระบบยังเตรียมขั้นตอนนัดหมาย กรุณารอจนสถานะพร้อมตรวจ",
    readinessTone: "neutral",
    paymentStatusLabel: "รอยืนยัน",
    paymentStatusDescription: "ยังไม่มีสถานะชำระเงินที่พร้อมใช้งาน",
    canOpenConsultRoom: false,
    consultRoomHref: null
  };
}

function mapConsultation(consultation: ConsultationWithDetails): DoctorConsultationItem {
  const latestPrescription = consultation.prescriptions[0] ?? null;
  const latestMessage = consultation.messages[0] ?? null;
  const workflow = getWorkflowStatus(consultation.status);

  return {
    id: consultation.id,
    patientName: consultation.patient.displayName ?? "LINE patient",
    patientLineId: consultation.patient.lineUserId,
    status: consultation.status,
    readinessLabel: workflow.readinessLabel,
    readinessTitle: workflow.readinessTitle,
    readinessDescription: workflow.readinessDescription,
    readinessTone: workflow.readinessTone,
    paymentStatusLabel: workflow.paymentStatusLabel,
    paymentStatusDescription: workflow.paymentStatusDescription,
    canOpenConsultRoom: workflow.canOpenConsultRoom,
    consultRoomHref: workflow.canOpenConsultRoom ? `/consult/live?consultation=${consultation.id}` : null,
    scheduledAt: formatDate(consultation.scheduledAt),
    summary: consultation.summary,
    prescriptionCount: consultation.prescriptions.length,
    latestPrescriptionId: latestPrescription?.id ?? null,
    latestPrescriptionStatus: latestPrescription?.status ?? null,
    latestPrescriptionNotes: latestPrescription?.notes ?? null,
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
