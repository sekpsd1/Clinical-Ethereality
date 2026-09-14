import { redirect } from "next/navigation";
import { isRewardPointsEnabled } from "@/features/rewards/config";
import { CustomerRewards } from "@/features/rewards/CustomerRewards";
import { getCustomerRewards } from "@/features/rewards/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function ProfileRewardsPage() {
  const session = await requireCurrentSession();

  if (!isRewardPointsEnabled()) {
    redirect("/profile");
  }

  const data = await getCustomerRewards(session);
  return <CustomerRewards data={data} />;
}
