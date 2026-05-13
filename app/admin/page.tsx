import { AdminDashboard } from "@/features/admin/AdminDashboard";
import { getAdminDashboardData } from "@/features/admin/dashboard/queries";

export default async function AdminPage() {
  const data = await getAdminDashboardData();

  return <AdminDashboard data={data} />;
}
