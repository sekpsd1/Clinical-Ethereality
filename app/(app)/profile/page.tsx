import { UserProfile } from "@/features/profile/UserProfile";
import { getCustomerProfileData } from "@/features/profile/queries";
import { getCustomerNotifications } from "@/features/notifications/queries";
import { requireRoleSession } from "@/lib/auth/guards";

export default async function ProfilePage() {
  const session = await requireRoleSession(["customer"], "/profile");
  const [data, notificationData] = await Promise.all([
    getCustomerProfileData(session),
    getCustomerNotifications(session)
  ]);

  return <UserProfile data={data} notificationData={notificationData} />;
}
