import { CustomerRewards } from "@/features/rewards/CustomerRewards";
import { getCustomerRewards } from "@/features/rewards/queries";
import { requireCurrentSession } from "@/lib/auth/session";

export default async function ProfileRewardsPage() {
  const session = await requireCurrentSession();
  const data = await getCustomerRewards(session);

  return <CustomerRewards data={data} />;
}
