import { AdminAuditLog } from "@/features/admin/AdminAuditLog";
import { getAdminAuditLogs } from "@/features/admin/audit/queries";

export default async function AdminAuditPage() {
  const data = await getAdminAuditLogs();

  return <AdminAuditLog data={data} />;
}
