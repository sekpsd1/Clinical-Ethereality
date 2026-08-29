import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import { issueZoomMeetingSdkSignature } from "@/lib/zoom/meeting-sdk";
import { getZoomHostZakIfConfigured } from "@/lib/zoom/meetings";
import { isLiveConsultationOpen } from "@/features/consultations/waiting-room/access";
import type { ZoomMeetingFrameAccess, ZoomMeetingJoinData } from "@/features/consultations/zoom/types";

export async function getZoomMeetingFrameAccess(
  consultationId?: string,
  now = new Date()
): Promise<ZoomMeetingFrameAccess> {
  noStore();

  const session = await getCurrentSession();
  const leavePath = session?.role === "doctor" || session?.role === "admin" ? "/doctor/consultations" : "/consult";
  const leaveUrl = new URL(leavePath, getAppEnv().NEXT_PUBLIC_APP_URL).toString();

  if (!session || !consultationId || session.userId.startsWith("dev:")) {
    return {
      available: false,
      consultationId: consultationId ?? null,
      message: "ไม่พบเซสชันหรือห้อง Zoom ที่พร้อมใช้งาน",
      leaveUrl
    };
  }

  if (session.role !== "customer" && session.role !== "doctor") {
    return {
      available: false,
      consultationId,
      message: "บัญชีนี้ไม่มีสิทธิ์เข้าห้อง Zoom สำหรับการปรึกษา",
      leaveUrl
    };
  }

  try {
    const consultation = await prisma.consultation.findFirst({
      where:
        session.role === "doctor"
          ? {
              id: consultationId,
              doctor: {
                userId: session.userId
              },
              status: "live",
              scheduledAt: {
                lte: now
              }
            }
          : {
              id: consultationId,
              patientId: session.userId,
              patient: {
                fullName: { not: null },
                dateOfBirth: { not: null },
                normalizedPhone: { not: null },
                phoneVerifiedAt: { not: null }
              },
              status: "live",
              scheduledAt: {
                lte: now
              }
            },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        zoomMeetingId: true
      }
    });

    if (
      !consultation?.zoomMeetingId ||
      !isLiveConsultationOpen(consultation.status, consultation.scheduledAt, now)
    ) {
      return {
        available: false,
        consultationId: consultation?.id ?? consultationId,
        message: "แพทย์ยังไม่ได้สร้างห้อง Zoom สำหรับนัดหมายนี้",
        leaveUrl
      };
    }

    return {
      available: true,
      consultationId: consultation.id,
      leaveUrl
    };
  } catch {
    return {
      available: false,
      consultationId,
      message: "ยังเตรียมห้อง Zoom ไม่สำเร็จ กรุณากลับไปที่ห้องปรึกษาแล้วลองใหม่",
      leaveUrl
    };
  }
}

export async function getZoomMeetingJoinData(
  consultationId?: string,
  now = new Date()
): Promise<ZoomMeetingJoinData> {
  noStore();

  const session = await getCurrentSession();
  const leavePath = session?.role === "doctor" || session?.role === "admin" ? "/doctor/consultations" : "/consult";
  const leaveUrl = new URL(leavePath, getAppEnv().NEXT_PUBLIC_APP_URL).toString();

  if (!session || !consultationId || session.userId.startsWith("dev:")) {
    return {
      available: false,
      consultationId: consultationId ?? null,
      message: "ไม่พบเซสชันหรือห้อง Zoom ที่พร้อมใช้งาน",
      leaveUrl
    };
  }

  if (session.role !== "customer" && session.role !== "doctor") {
    return {
      available: false,
      consultationId,
      message: "บัญชีนี้ไม่มีสิทธิ์เข้าห้อง Zoom สำหรับการปรึกษา",
      leaveUrl
    };
  }

  try {
    const consultation = await prisma.consultation.findFirst({
      where:
        session.role === "doctor"
          ? {
              id: consultationId,
              doctor: {
                userId: session.userId
              },
              status: "live",
              scheduledAt: {
                lte: now
              }
            }
          : {
              id: consultationId,
              patientId: session.userId,
              patient: {
                fullName: { not: null },
                dateOfBirth: { not: null },
                normalizedPhone: { not: null },
                phoneVerifiedAt: { not: null }
              },
              status: "live",
              scheduledAt: {
                lte: now
              }
            },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        zoomMeetingId: true,
        zoomPassword: true
      }
    });

    if (
      !consultation?.zoomMeetingId ||
      !isLiveConsultationOpen(consultation.status, consultation.scheduledAt, now)
    ) {
      return {
        available: false,
        consultationId: consultation?.id ?? consultationId,
        message: "แพทย์ยังไม่ได้สร้างห้อง Zoom สำหรับนัดหมายนี้",
        leaveUrl
      };
    }

    const isHost = session.role === "doctor";
    const signature = await issueZoomMeetingSdkSignature(consultation.zoomMeetingId, isHost ? 1 : 0);

    if (!signature) {
      return {
        available: false,
        consultationId: consultation.id,
        message: "ยังไม่ได้ตั้งค่า Zoom Meeting SDK Client ID และ Client Secret",
        leaveUrl
      };
    }

    const zak = isHost ? await getZoomHostZakIfConfigured() : null;

    if (isHost && !zak) {
      return {
        available: false,
        consultationId: consultation.id,
        message: "ยังไม่ได้ตั้งค่า Zoom host สำหรับแพทย์/ผู้ดูแลระบบ",
        leaveUrl
      };
    }

    return {
      available: true,
      consultationId: consultation.id,
      meetingNumber: consultation.zoomMeetingId,
      password: consultation.zoomPassword ?? "",
      signature,
      ...(zak ? { zak } : {}),
      userName: session.displayName || (session.role === "doctor" ? "Doctor" : "Patient"),
      leaveUrl
    };
  } catch {
    return {
      available: false,
      consultationId,
      message: "ยังเตรียมห้อง Zoom ไม่สำเร็จ กรุณากลับไปที่ห้องปรึกษาแล้วลองใหม่",
      leaveUrl
    };
  }
}
