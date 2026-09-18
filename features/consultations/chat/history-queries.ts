import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import type { ConsultationChatHistoryData } from "@/features/consultations/chat/history-types";

export const consultationChatHistoryPageSize = 50;

type HistoryViewerRole = ConsultationChatHistoryData["viewerRole"];

function normalizePage(page: number): number {
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function getConsultationAccessWhere(
  session: PublicSession,
  consultationId: string,
  viewerRole: HistoryViewerRole
): Prisma.ConsultationWhereInput {
  if (viewerRole === "customer") {
    return {
      id: consultationId,
      status: "completed",
      patient: {
        id: session.userId,
        role: "customer",
        status: "active"
      }
    };
  }

  return {
    id: consultationId,
    status: "completed",
    doctor: {
      userId: session.userId,
      status: "approved",
      user: {
        role: "doctor",
        status: "active"
      }
    }
  };
}

export async function getConsultationChatHistory(
  session: PublicSession,
  consultationId: string,
  viewerRole: HistoryViewerRole,
  requestedPage = 1
): Promise<ConsultationChatHistoryData | null> {
  noStore();

  if (
    !consultationId ||
    session.userId.startsWith("dev:") ||
    session.role !== viewerRole
  ) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: getConsultationAccessWhere(session, consultationId, viewerRole),
      select: {
        id: true,
        patient: {
          select: {
            displayName: true
          }
        },
        doctor: {
          select: {
            user: {
              select: {
                displayName: true
              }
            }
          }
        }
      }
    });

    if (!consultation) {
      return null;
    }

    const messageWhere: Prisma.ConsultationMessageWhereInput = {
      consultationId: consultation.id,
      status: "visible"
    };
    const totalMessages = await tx.consultationMessage.count({ where: messageWhere });
    const totalPages = Math.max(1, Math.ceil(totalMessages / consultationChatHistoryPageSize));
    const page = Math.min(normalizePage(requestedPage), totalPages);
    const messages = await tx.consultationMessage.findMany({
      where: messageWhere,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * consultationChatHistoryPageSize,
      take: consultationChatHistoryPageSize,
      select: {
        id: true,
        body: true,
        senderId: true,
        createdAt: true,
        sender: {
          select: {
            displayName: true,
            lineUserId: true,
            role: true
          }
        }
      }
    });

    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "consultation_message.history_view",
      entityType: "consultation",
      entityId: consultation.id,
      metadata: {
        consultationId: consultation.id,
        messageIds: messages.map((message) => message.id)
      }
    });

    return {
      consultationId: consultation.id,
      viewerRole,
      counterpartName:
        viewerRole === "customer"
          ? consultation.doctor.user.displayName ?? "แพทย์ผู้ให้คำปรึกษา"
          : consultation.patient.displayName ?? "ผู้รับบริการ",
      messages: messages.map((message) => ({
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        senderName: message.sender.displayName ?? message.sender.lineUserId,
        senderRole: message.sender.role,
        isOwnMessage: message.senderId === session.userId
      })),
      page,
      pageSize: consultationChatHistoryPageSize,
      totalMessages,
      totalPages
    };
  });
}
