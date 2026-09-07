import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import { issueZoomMeetingSdkSignature } from "@/lib/zoom/meeting-sdk";
import { getZoomHostZakIfConfigured } from "@/lib/zoom/meetings";
import { isLiveConsultationOpen } from "@/features/consultations/waiting-room/access";
import { createZoomAttendanceCredential } from "@/features/consultations/attendance/identity";
import {
  buildZoomConsultationAccessWhere,
  type ZoomConsultationViewer
} from "@/features/consultations/zoom/access";
import { getZoomExternalViewer } from "@/features/consultations/zoom/external-handoff";
import type { ZoomMeetingJoinData, ZoomMeetingLaunchAccess } from "@/features/consultations/zoom/types";

export async function getZoomMeetingLaunchAccess(
  consultationId?: string,
  now = new Date()
): Promise<ZoomMeetingLaunchAccess> {
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
      where: buildZoomConsultationAccessWhere(
        {
          userId: session.userId,
          role: session.role,
          displayName: session.displayName
        },
        consultationId,
        now
      ),
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
  const leavePath = session?.role === "doctor" ? "/doctor/consultations" : "/consult";
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

  return getZoomMeetingJoinDataForViewer(
    {
      userId: session.userId,
      role: session.role,
      displayName: session.displayName
    },
    consultationId,
    leaveUrl,
    now
  );
}

async function getZoomMeetingJoinDataForViewer(
  viewer: ZoomConsultationViewer,
  consultationId: string,
  leaveUrl: string,
  now: Date
): Promise<ZoomMeetingJoinData> {
  try {
    const consultation = await prisma.consultation.findFirst({
      where: buildZoomConsultationAccessWhere(viewer, consultationId, now),
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

    const isHost = viewer.role === "doctor";
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

    const attendanceCredential = createZoomAttendanceCredential(
      viewer.role,
      now
    );
    await prisma.consultationAttendanceCredential.create({
      data: {
        consultationId: consultation.id,
        role: viewer.role,
        customerKeyHash: attendanceCredential.customerKeyHash,
        expiresAt: attendanceCredential.expiresAt
      }
    });

    return {
      available: true,
      consultationId: consultation.id,
      meetingNumber: consultation.zoomMeetingId,
      password: consultation.zoomPassword ?? "",
      signature,
      ...(zak ? { zak } : {}),
      userName: viewer.displayName || (viewer.role === "doctor" ? "Doctor" : "Patient"),
      customerKey: attendanceCredential.customerKey,
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

export async function getZoomExternalMeetingJoinData(
  consultationId?: string,
  now = new Date()
): Promise<ZoomMeetingJoinData> {
  noStore();

  const leaveUrl = new URL("/zoom-sdk/index.html?complete=1", getAppEnv().NEXT_PUBLIC_APP_URL).toString();

  if (!consultationId) {
    return {
      available: false,
      consultationId: null,
      message: "ไม่พบสิทธิ์ชั่วคราวสำหรับห้อง Zoom นี้",
      leaveUrl
    };
  }

  const viewer = await getZoomExternalViewer(consultationId, now);

  if (!viewer) {
    return {
      available: false,
      consultationId,
      message: "สิทธิ์ชั่วคราวหมดอายุหรือถูกใช้จากเบราว์เซอร์อื่นแล้ว",
      leaveUrl
    };
  }

  return getZoomMeetingJoinDataForViewer(viewer, consultationId, leaveUrl, now);
}
