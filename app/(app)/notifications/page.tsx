import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import { getCustomerNotifications } from "@/features/notifications/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function NotificationsPage() {
  const session = await requireCurrentSession();
  const data = await getCustomerNotifications(session);

  return <NotificationCenter data={data} />;
}
