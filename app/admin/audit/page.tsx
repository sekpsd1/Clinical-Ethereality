import { AdminAuditLog } from "@/features/admin/AdminAuditLog";
import { getAdminAuditLogs } from "@/features/admin/audit/queries";

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const parsedPage = Number.parseInt(page ?? "1", 10);
  const data = await getAdminAuditLogs(Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1);

  return <AdminAuditLog data={data} />;
}
