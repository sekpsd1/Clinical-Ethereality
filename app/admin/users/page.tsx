import { AdminUserApprovals } from "@/features/admin/AdminUserApprovals";
import { getAdminUserApprovals } from "@/features/admin/users/queries";

export default async function AdminUsersPage() {
  const data = await getAdminUserApprovals();

  return <AdminUserApprovals data={data} />;
}
