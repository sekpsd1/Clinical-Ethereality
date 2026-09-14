import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import type { AdminAuditLogData, AdminAuditLogItem } from "@/features/admin/audit/types";
import { isRewardPointsEnabled } from "@/features/rewards/config";

const PAGE_SIZE = 25;

function getVisibleAuditWhere(rewardsEnabled: boolean) {
  return rewardsEnabled
    ? undefined
    : {
        NOT: [
          { action: { startsWith: "reward." } },
          { entityType: "reward_point" }
        ]
      };
}

function getAuditLogs(page: number, rewardsEnabled: boolean) {
  return prisma.auditLog.findMany({
    where: getVisibleAuditWhere(rewardsEnabled),
    orderBy: {
      createdAt: "desc"
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
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

type AuditLogRecord = Awaited<ReturnType<typeof getAuditLogs>>[number];

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

export async function getAdminAuditLogs(requestedPage = 1): Promise<AdminAuditLogData> {
  noStore();

  try {
    const rewardsEnabled = isRewardPointsEnabled();
    const where = getVisibleAuditWhere(rewardsEnabled);
    const total = await prisma.auditLog.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(Math.max(1, requestedPage), totalPages);
    const [records, entityCounts] = await Promise.all([
      getAuditLogs(page, rewardsEnabled),
      prisma.auditLog.groupBy({
        where,
        by: ["entityType"],
        _count: {
          _all: true
        }
      })
    ]);
    const logs = records.map(mapAuditLog);
    const countByEntity = new Map(
      entityCounts.map((item) => [item.entityType, item._count._all])
    );

    return {
      logs,
      summary: {
        total,
        payment: countByEntity.get("payment") ?? 0,
        prescription: countByEntity.get("prescription") ?? 0,
        operations: ["order", "inventory", "product", "user"].reduce(
          (sum, entityType) => sum + (countByEntity.get(entityType) ?? 0),
          0
        )
      },
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalPages
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
      pagination: {
        page: 1,
        pageSize: PAGE_SIZE,
        totalPages: 1
      },
      unavailable: true
    };
  }
}
