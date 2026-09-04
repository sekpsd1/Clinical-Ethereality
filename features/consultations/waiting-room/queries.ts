import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { CLINIC_TIME_ZONE } from "@/features/consultations/booking/slots";
import { staffFileEntityTypes } from "@/features/staff-files/types";
import { getWaitingRoomTiming } from "@/features/consultations/waiting-room/access";
import type { ConsultationWaitingRoomData } from "@/features/consultations/waiting-room/types";

function formatScheduledAt(date: Date | null): string {
  if (!date) {
    return "กำลังปรึกษา";
  }

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: CLINIC_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export async function getConsultationWaitingRoom(
  consultationId?: string,
  now = new Date()
): Promise<ConsultationWaitingRoomData | null> {
  noStore();

  const session = await getCurrentSession();

  if (
    !session ||
    !consultationId ||
    session.userId.startsWith("dev:") ||
    (session.role !== "customer" && session.role !== "doctor")
  ) {
    return null;
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
          : {
              id: consultationId,
              patientId: session.userId,
              status: {
                in: ["scheduled", "live"]
              }
            },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        doctor: {
          select: {
            userId: true,
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

    if (!consultation || (consultation.status !== "scheduled" && consultation.status !== "live")) {
      return null;
    }

    // The staff profile attachment is the authoritative photo uploaded in Admin.
    // Prefer it when a legacy User.avatarUrl still points to a seeded placeholder.
    const profilePhoto = await prisma.fileAttachment.findFirst({
      where: {
        ownerId: consultation.doctor.userId,
        entityType: staffFileEntityTypes.profilePhoto,
        status: "attached",
        storageKey: { not: null }
      },
      select: {
        storageUrl: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const timing = getWaitingRoomTiming(consultation.status, consultation.scheduledAt, now);

    if (!timing) {
      return null;
    }

    return {
      consultationId: consultation.id,
      viewerRole: session.role,
      consultationStatus: consultation.status,
      doctorName: consultation.doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
      doctorImageUrl:
        profilePhoto?.storageUrl ?? consultation.doctor.user.avatarUrl ?? "/images/doctors/waiting-avatar.png",
      scheduledLabel: formatScheduledAt(consultation.scheduledAt),
      statusMessage:
        consultation.status === "live"
          ? "แพทย์เปิดห้องปรึกษาแล้ว"
          : "ยืนยันการชำระเงินเรียบร้อยแล้ว",
      countdownTitle: timing.countdownTitle,
      countdownValue: timing.countdownValue,
      canEnterLive: timing.canEnterLive,
      liveHref: timing.canEnterLive
        ? `/consult/live?consultation=${encodeURIComponent(consultation.id)}`
        : null,
      returnHref:
        session.role === "doctor"
          ? "/doctor/consultations"
          : `/consult/appointments/${encodeURIComponent(consultation.id)}`
    };
  } catch {
    return null;
  }
}
