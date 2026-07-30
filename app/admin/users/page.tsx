import { AdminUserApprovals } from "@/features/admin/AdminUserApprovals";
import {
  normalizeAdminStaffPage,
  normalizeAdminStaffQuery,
  normalizeAdminStaffTab
} from "@/features/admin/users/filters";
import { getAdminUserApprovals } from "@/features/admin/users/queries";
import { requireAdminSession } from "@/lib/auth/guards";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const session = await requireAdminSession();
  const params = await searchParams;
  const data = await getAdminUserApprovals({
    page: normalizeAdminStaffPage(params.page),
    query: normalizeAdminStaffQuery(params.q),
    status: normalizeAdminStaffTab(params.status)
  });

  return <AdminUserApprovals data={data} currentUserId={session.userId} />;
}
