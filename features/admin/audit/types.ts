export type AdminAuditLogItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  actorRole: string;
  createdAt: string;
  metadata: string;
};

export type AdminAuditLogData = {
  logs: AdminAuditLogItem[];
  summary: {
    total: number;
    payment: number;
    prescription: number;
    operations: number;
  };
  unavailable?: boolean;
};
