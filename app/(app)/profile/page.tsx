import { UserProfile } from "@/features/profile/UserProfile";
import { getCustomerProfileData } from "@/features/profile/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function ProfilePage() {
  const session = await requireCurrentSession();
  const data = await getCustomerProfileData(session);

  return <UserProfile data={data} />;
}
