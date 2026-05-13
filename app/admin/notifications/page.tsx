import { AdminNotifications } from "@/features/admin/AdminNotifications";
import { getAdminNotifications } from "@/features/admin/notifications/queries";

export default async function AdminNotificationsPage() {
  const data = await getAdminNotifications();

  return <AdminNotifications data={data} />;
}
