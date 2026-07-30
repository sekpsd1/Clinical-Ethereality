import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getAppEnv } from "@/lib/env/schema";
import { issueZoomMeetingSdkSignature } from "@/lib/zoom/meeting-sdk";
import type { ZoomMeetingJoinData } from "@/features/consultations/zoom/types";

export async function getZoomMeetingJoinData(consultationId?: string): Promise<ZoomMeetingJoinData> {
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

  try {
    const consultation = await prisma.consultation.findFirst({
      where:
        session.role === "doctor"
          ? {
              id: consultationId,
              doctor: {
                userId: session.userId
              },
              status: {
                in: ["scheduled", "live"]
              }
            }
          : session.role === "admin"
            ? {
                id: consultationId,
                status: {
                  in: ["scheduled", "live"]
                }
              }
            : {
                id: consultationId,
                patientId: session.userId,
                status: {
                  in: ["scheduled", "live"]
                }
              },
      select: {
        id: true,
        zoomMeetingId: true,
        zoomPassword: true
      }
    });

    if (!consultation?.zoomMeetingId) {
      return {
        available: false,
        consultationId: consultation?.id ?? consultationId,
        message: "แพทย์ยังไม่ได้สร้างห้อง Zoom สำหรับนัดหมายนี้",
        leaveUrl
      };
    }

    const signature = await issueZoomMeetingSdkSignature(consultation.zoomMeetingId);

    if (!signature) {
      return {
        available: false,
        consultationId: consultation.id,
        message: "ยังไม่ได้ตั้งค่า Zoom Meeting SDK Client ID และ Client Secret",
        leaveUrl
      };
    }

    return {
      available: true,
      consultationId: consultation.id,
      meetingNumber: consultation.zoomMeetingId,
      password: consultation.zoomPassword ?? "",
      signature,
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
