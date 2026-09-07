import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import { getCustomerNotifications } from "@/features/notifications/queries";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function NotificationsPage() {
  const session = await requireRoleSession(["customer"], "/notifications");
  const data = await getCustomerNotifications(session);

  return <NotificationCenter data={data} />;
}
