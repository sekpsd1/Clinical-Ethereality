import { AdminNotifications } from "@/features/admin/AdminNotifications";
import { getAdminNotifications } from "@/features/admin/notifications/queries";
import { isRewardPointsEnabled } from "@/features/rewards/config";

export default async function AdminNotificationsPage() {
  const data = await getAdminNotifications();

  return <AdminNotifications data={data} rewardsEnabled={isRewardPointsEnabled()} />;
}
