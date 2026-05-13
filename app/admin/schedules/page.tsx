import { AdminSchedules } from "@/features/admin/AdminSchedules";
import { getAdminSchedules } from "@/features/admin/schedules/queries";

export default async function AdminSchedulesPage() {
  const data = await getAdminSchedules();

  return <AdminSchedules data={data} />;
}
