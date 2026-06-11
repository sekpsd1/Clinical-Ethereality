import { unstable_noStore as noStore } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { LiveConsultationChatData, LiveConsultationChatMessage } from "@/features/consultations/chat/types";

const fallbackMessages: LiveConsultationChatMessage[] = [
  {
    id: "fallback-doctor-1",
    body: "สวัสดีครับ วันนี้มีอาการเป็นอย่างไรบ้างครับ?",
    createdAt: "10:45",
    senderName: "Dr. Aris Thorne",
    senderRole: "doctor",
    isOwnMessage: false
  },
  {
    id: "fallback-patient-1",
    body: "สวัสดีค่ะคุณหมอ รู้สึกปวดศีรษะมา 2 วันแล้วค่ะ และมีไข้ต่ำ ๆ ด้วย",
    createdAt: "10:46",
    senderName: "Patient",
    senderRole: "customer",
    isOwnMessage: true
  },
  {
    id: "fallback-doctor-2",
    body: "หมอแนะนำให้พักผ่อนมาก ๆ และดื่มน้ำให้เพียงพอนะครับ เดี๋ยวหมอจะสรุปคำแนะนำหลังปรึกษาให้",
    createdAt: "10:48",
    senderName: "Dr. Aris Thorne",
    senderRole: "doctor",
    isOwnMessage: false
  }
];

const fallbackChatData: LiveConsultationChatData = {
  consultationId: null,
  doctorName: "Dr. Aris Thorne",
  doctorImageUrl: "/images/doctors/waiting-profile.png",
  patientImageUrl: "/images/profiles/current-user.png",
  statusLabel: "Live",
  canSend: false,
  messages: fallbackMessages
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

  if (!session || session.userId.startsWith("dev:")) {
    return fallbackChatData;
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
      return fallbackChatData;
    }

    return {
      consultationId: consultation.id,
      doctorName: consultation.doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา",
      doctorImageUrl: consultation.doctor.user.avatarUrl ?? "/images/doctors/waiting-profile.png",
      patientImageUrl: consultation.patient.avatarUrl ?? "/images/profiles/current-user.png",
      statusLabel: consultation.status === "live" ? "Live" : consultation.status === "completed" ? "เสร็จสิ้น" : "นัดหมายแล้ว",
      canSend: consultation.status === "scheduled" || consultation.status === "live",
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
    return fallbackChatData;
  }
}
