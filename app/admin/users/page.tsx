import { AdminUserApprovals } from "@/features/admin/AdminUserApprovals";
import { getAdminUserApprovals } from "@/features/admin/users/queries";
import { requireAdminSession } from "@/lib/auth/guards";

export default async function AdminUsersPage() {
  const session = await requireAdminSession();
  const data = await getAdminUserApprovals();

  return <AdminUserApprovals data={data} currentUserId={session.userId} />;
}
