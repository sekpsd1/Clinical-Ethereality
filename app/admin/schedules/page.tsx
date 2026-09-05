import { AdminSchedules } from "@/features/admin/AdminSchedules";
import { getAdminSchedules } from "@/features/admin/schedules/queries";

export default async function AdminSchedulesPage({
  searchParams
}: {
  searchParams: Promise<{
    edit?: string;
    date?: string;
    doctor?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getAdminSchedules({ date: params.date, doctorId: params.doctor, view: params.view });

  return <AdminSchedules data={data} editSlotId={params.edit} />;
}
