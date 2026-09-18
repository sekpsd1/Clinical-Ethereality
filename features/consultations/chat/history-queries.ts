import { unstable_noStore as noStore } from "next/cache";
import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/audit-log";
import type { PublicSession } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import type { ConsultationChatHistoryData } from "@/features/consultations/chat/history-types";

export const consultationChatHistoryPageSize = 50;
export const consultationChatExportFilename = "clinical-lab-chat-history.txt";

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

function isEligibleHistoryViewer(
  session: PublicSession,
  consultationId: string,
  viewerRole: HistoryViewerRole
): boolean {
  return Boolean(
    consultationId &&
    !session.userId.startsWith("dev:") &&
    session.role === viewerRole
  );
}

function formatExportDateTime(value: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: "Asia/Bangkok"
  }).format(value);
}

const exportSenderRoleLabels = {
  admin: "แอดมิน",
  customer: "ผู้รับบริการ",
  doctor: "แพทย์",
  pharmacist: "เภสัชกร"
} as const;

export function formatConsultationChatExport(
  messages: Array<{
    body: string;
    createdAt: Date;
    sender: { role: keyof typeof exportSenderRoleLabels };
  }>
): string {
  const header = [
    "ประวัติแชตในแอป Clinical lab service",
    "ไฟล์นี้แสดงเฉพาะแชตในแอปและไม่รวม Zoom Chat",
    ""
  ];
  const body = messages.length === 0
    ? ["ไม่มีข้อความ"]
    : messages.flatMap((message, index) => [
        `ข้อความ ${index + 1} · ${formatExportDateTime(message.createdAt)} · ${exportSenderRoleLabels[message.sender.role]}`,
        message.body,
        ""
      ]);

  return `\uFEFF${[...header, ...body].join("\n").trimEnd()}\n`;
}

export async function getConsultationChatHistory(
  session: PublicSession,
  consultationId: string,
  viewerRole: HistoryViewerRole,
  requestedPage = 1
): Promise<ConsultationChatHistoryData | null> {
  noStore();

  if (!isEligibleHistoryViewer(session, consultationId, viewerRole)) {
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

export async function getConsultationChatExport(
  session: PublicSession,
  consultationId: string,
  viewerRole: HistoryViewerRole
): Promise<{ content: string; messageCount: number } | null> {
  noStore();

  if (!isEligibleHistoryViewer(session, consultationId, viewerRole)) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: getConsultationAccessWhere(session, consultationId, viewerRole),
      select: { id: true }
    });
    if (!consultation) return null;

    const messages = await tx.consultationMessage.findMany({
      where: {
        consultationId: consultation.id,
        status: "visible"
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        body: true,
        createdAt: true,
        sender: {
          select: { role: true }
        }
      }
    });

    await writeAuditLog(tx, {
      actorId: session.userId,
      action: "consultation_message.history_download",
      entityType: "consultation",
      entityId: consultation.id,
      metadata: {
        consultationId: consultation.id,
        messageCount: messages.length,
        messageIds: messages.map((message) => message.id)
      }
    });

    return {
      content: formatConsultationChatExport(messages),
      messageCount: messages.length
    };
  });
}
