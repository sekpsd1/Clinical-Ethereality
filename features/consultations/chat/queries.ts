import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isZoomMeetingSdkConfigured } from "@/lib/zoom/meeting-sdk";
import type { LiveConsultationChatData } from "@/features/consultations/chat/types";

const emptyChatData: LiveConsultationChatData = {
  consultationId: null,
  viewerRole: null,
  doctorName: "แพทย์ผู้ให้คำปรึกษา",
  doctorImageUrl: "/images/doctors/waiting-profile.png",
  patientImageUrl: "/images/profiles/current-user.png",
  statusLabel: "ยังไม่มีห้อง",
  canSend: false,
  videoHref: null,
  videoMode: "unavailable",
  returnHref: "/consult",
  messages: []
};

function formatMessageTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export async function getLiveConsultationChat(consultationId?: string): Promise<LiveConsultationChatData> {
  noStore();

  const session = await getCurrentSession();

  if (!session) {
    return emptyChatData;
  }

  const sessionEmptyData: LiveConsultationChatData = {
    ...emptyChatData,
    viewerRole: session.role,
    doctorName: session.role === "doctor" ? session.displayName ?? "แพทย์ผู้ให้คำปรึกษา" : emptyChatData.doctorName,
    returnHref: session.role === "doctor" || session.role === "admin" ? "/doctor/consultations" : "/consult"
  };

  if (session.userId.startsWith("dev:")) {
    return sessionEmptyData;
  }

  try {
    const consultation = await prisma.consultation.findFirst({
      where:
        consultationId
          ? session.role === "doctor"
            ? {
                id: consultationId,
                doctor: {
                  userId: session.userId
                },
                status: {
                  in: ["scheduled", "live", "completed"]
                }
              }
            : session.role === "admin"
              ? {
                  id: consultationId,
                  status: {
                    in: ["scheduled", "live", "completed"]
                  }
                }
              : {
                  id: consultationId,
                  patientId: session.userId,
                  status: {
                    in: ["scheduled", "live", "completed"]
                  }
                }
          : session.role === "doctor"
          ? {
              doctor: {
                userId: session.userId
              },
              status: {
                in: ["scheduled", "live", "completed"]
              }
            }
          : session.role === "admin"
            ? {
                status: {
                  in: ["scheduled", "live", "completed"]
                }
              }
            : {
                patientId: session.userId,
                status: {
                  in: ["scheduled", "live", "completed"]
                }
              },
      orderBy: [
        {
          scheduledAt: "desc"
        },
        {
          updatedAt: "desc"
        }
      ],
      include: {
        patient: true,
        doctor: {
          include: {
            user: true
          }
        },
        messages: {
          where: {
            status: "visible"
          },
          orderBy: {
            createdAt: "asc"
          },
          take: 50,
          include: {
            sender: true
          }
        }
      }
    });

    if (!consultation) {
      return sessionEmptyData;
    }

    const sdkConfigured = isZoomMeetingSdkConfigured();
    const videoHref =
      consultation.zoomMeetingId && sdkConfigured
        ? `/consult/live/zoom?consultation=${consultation.id}`
        : consultation.zoomJoinUrl;

    return {
      consultationId: consultation.id,
      viewerRole: session.role,
      doctorName: consultation.doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
      doctorImageUrl: consultation.doctor.user.avatarUrl ?? "/images/doctors/waiting-profile.png",
      patientImageUrl: consultation.patient.avatarUrl ?? "/images/profiles/current-user.png",
      statusLabel: consultation.status === "live" ? "Live" : consultation.status === "completed" ? "เสร็จสิ้น" : "นัดหมายแล้ว",
      canSend: consultation.status === "scheduled" || consultation.status === "live",
      videoHref,
      videoMode:
        consultation.zoomMeetingId && sdkConfigured
          ? "meeting_sdk"
          : consultation.zoomJoinUrl
            ? "external"
            : "unavailable",
      returnHref:
        session.role === "doctor" || session.role === "admin"
          ? "/doctor/consultations"
          : consultation.status === "completed"
            ? "/consult/advice-log"
            : `/consult/appointments/${consultation.id}`,
      messages: consultation.messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: formatMessageTime(message.createdAt),
        senderName: message.sender.displayName ?? message.sender.lineUserId,
        senderRole: message.sender.role,
        isOwnMessage: message.senderId === session.userId
      }))
    };
  } catch {
    return sessionEmptyData;
  }
}
