import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminAuditLogData, AdminAuditLogItem } from "@/features/admin/audit/types";

type AuditLogRecord = Awaited<ReturnType<typeof getAuditLogs>>[number];

function getAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 100,
    include: {
      actor: {
        select: {
          displayName: true,
          lineUserId: true,
          role: true
        }
      }
    }
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatMetadata(value: unknown): string {
  if (!value) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

function getActorLabel(log: AuditLogRecord): string {
  if (!log.actor) {
    return "System or deleted user";
  }

  return log.actor.displayName ?? log.actor.lineUserId;
}

function mapAuditLog(log: AuditLogRecord): AdminAuditLogItem {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId ?? "-",
    actor: getActorLabel(log),
    actorRole: log.actor?.role ?? "system",
    createdAt: formatDate(log.createdAt),
    metadata: formatMetadata(log.metadataJson)
  };
}

export async function getAdminAuditLogs(): Promise<AdminAuditLogData> {
  noStore();

  try {
    const logs = (await getAuditLogs()).map(mapAuditLog);

    return {
      logs,
      summary: {
        total: logs.length,
        payment: logs.filter((log) => log.entityType === "payment").length,
        prescription: logs.filter((log) => log.entityType === "prescription").length,
        operations: logs.filter((log) => ["order", "inventory", "product", "user"].includes(log.entityType)).length
      }
    };
  } catch {
    return {
      logs: [],
      summary: {
        total: 0,
        payment: 0,
        prescription: 0,
        operations: 0
      },
      unavailable: true
    };
  }
}
