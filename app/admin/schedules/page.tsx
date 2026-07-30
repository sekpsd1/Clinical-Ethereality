import { AdminSchedules } from "@/features/admin/AdminSchedules";
import { getAdminSchedules } from "@/features/admin/schedules/queries";

export default async function AdminSchedulesPage({
  searchParams
}: {
  searchParams: Promise<{
    edit?: string;
  }>;
}) {
  const { edit } = await searchParams;
  const data = await getAdminSchedules();

  return <AdminSchedules data={data} editSlotId={edit} />;
}
