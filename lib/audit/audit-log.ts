import type { Prisma } from "@prisma/client";

type WriteAuditLogInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function getPersistableActorId(actorId: string | null | undefined): string | null {
  if (!actorId || actorId.startsWith("dev:")) {
    return null;
  }

  return actorId;
}

export async function writeAuditLog(tx: Prisma.TransactionClient, input: WriteAuditLogInput): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: getPersistableActorId(input.actorId),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadataJson: input.metadata === undefined ? undefined : toJsonValue(input.metadata)
    }
  });
}
